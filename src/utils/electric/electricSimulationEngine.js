// src/utils/electric/electricSimulationEngine.js

// --- Helper Functions ---
const addMinutesToTime = (timeStr, minutes) => {
  if (!timeStr) return '';
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + Math.round(minutes);
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
};

const getDynamicTripDuration = (startTime, baseDuration, peakHours, reducedHours) => {
  const startMinutes = timeToMinutes(startTime);
  let duration = baseDuration;
  for (const peak of peakHours || []) {
    if (startMinutes >= timeToMinutes(peak.startTime) && startMinutes < timeToMinutes(peak.endTime)) {
      duration += Number(peak.extraTime || 0); break;
    }
  }
  for (const reduced of reducedHours || []) {
    if (startMinutes >= timeToMinutes(reduced.startTime) && startMinutes < timeToMinutes(reduced.endTime)) {
      duration -= Number(reduced.reducedTime || 0); break;
    }
  }
  return duration;
};

// --- The Core, Crash-Proof Simulation Engine ---
export default function runElectricSimulation({ route, electricParams, callingTime, totalBuses, breakInfo, peakHours, reducedHours }) {
  const { fleetSize, batteryRangeHours, chargingTimeHours, numberOfChargers } = electricParams;
  const { breakDuration } = breakInfo;
  const baseUpTripMinutes = route.upregularKm * route.timePerKm;
  const baseDownTripMinutes = route.downregularKm * route.timePerKm;
  const dutyDurationMinutes = 8 * 60;
  const breakTriggerMinutes = 4 * 60;
  const prepTimeMinutes = 15;
  const simulationEndTime = 24 * 60;

  const workBlockNames = Array.from({ length: fleetSize }, (_, i) => `Work Block ${i + 1}`);
  const busNames = Array.from({ length: totalBuses }, (_, i) => `Bus ${i + 1}`);
  
  const workBlockData = {};
  workBlockNames.forEach(name => {
    workBlockData[name] = { events: [], totalKm: 0, totalHours: 0 };
  });
  
  let availableBusPool = busNames.map(name => ({ busName: name, availableAtMinutes: 0 }));
  let depotChargers = Array(Number(numberOfChargers)).fill(0);
  
  let workQueue = [];
  const headway = (baseUpTripMinutes + baseDownTripMinutes) / fleetSize || 1;
  for (let i = 0; i < fleetSize; i++) {
    const blockName = workBlockNames[i];
    const departureOffset = i * headway;
    const startTime = addMinutesToTime(callingTime, departureOffset);
    workQueue.push({ type: 'START_DUTY', blockName, time: startTime, shiftNumber: 1 });
  }

  // Main Simulation Loop
  while (workQueue.length > 0) {
    workQueue.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const currentWork = workQueue.shift();
    const blockKey = currentWork.blockName;

    if (timeToMinutes(currentWork.time) >= simulationEndTime) continue;
    
    availableBusPool.sort((a, b) => a.availableAtMinutes - b.availableAtMinutes);
    let assignedBus = availableBusPool.shift();
    if (!assignedBus) continue;

    let currentBus = assignedBus.busName;
    const dutyStartTime = currentWork.time;
    const dutyStartTimeInMinutes = timeToMinutes(dutyStartTime);

    const turnoutEnd = addMinutesToTime(dutyStartTime, prepTimeMinutes);
    workBlockData[blockKey].events.push({ type: 'Turnout', time: `${dutyStartTime} - ${turnoutEnd}`, bus: currentBus });
    
    let currentTime = turnoutEnd;
    let busBatteryMinutes = batteryRangeHours * 60;
    let breakTaken = false;

    // Inner loop for this specific work segment
    while (true) {
        const dutyMinutesElapsed = timeToMinutes(currentTime) - dutyStartTimeInMinutes;
        const upTripDuration = getDynamicTripDuration(currentTime, baseUpTripMinutes, peakHours, reducedHours);
        const downTripDuration = getDynamicTripDuration(addMinutesToTime(currentTime, upTripDuration), baseDownTripMinutes, peakHours, reducedHours);
        const roundTripDuration = upTripDuration + downTripDuration;

        if (dutyMinutesElapsed >= dutyDurationMinutes || busBatteryMinutes < roundTripDuration) {
            break; // Exit the loop to end this segment
        }

        if (!breakTaken && dutyMinutesElapsed >= breakTriggerMinutes) {
            const breakEnd = addMinutesToTime(currentTime, breakDuration);
            workBlockData[blockKey].events.push({ type: 'Break', time: `${currentTime} - ${breakEnd}`, bus: currentBus });
            currentTime = breakEnd;
            breakTaken = true;
        }
        
        const upEnd = addMinutesToTime(currentTime, upTripDuration);
        workBlockData[blockKey].events.push({ type: 'Trip', time: currentTime, description: `${route.from} -> ${route.to}`, bus: currentBus });
        
        const downEnd = addMinutesToTime(upEnd, downTripDuration);
        workBlockData[blockKey].events.push({ type: 'Trip', time: upEnd, description: `${route.to} -> ${route.from}`, bus: currentBus });
        
        currentTime = downEnd;
        busBatteryMinutes -= roundTripDuration;
        workBlockData[blockKey].totalKm += route.upregularKm + route.downregularKm;
    }
    
    const finalDutyMinutesForSegment = timeToMinutes(currentTime) - dutyStartTimeInMinutes;
    workBlockData[blockKey].totalHours += finalDutyMinutesForSegment / 60;

    const earliestChargerTime = Math.min(...depotChargers);
    const chargerIndex = depotChargers.indexOf(earliestChargerTime);
    const chargeStartTime = Math.max(timeToMinutes(currentTime), earliestChargerTime);
    availableBusPool.push({ busName: currentBus, availableAtMinutes: chargeStartTime + chargingTimeHours * 60 });

    if (finalDutyMinutesForSegment >= dutyDurationMinutes) {
        if (currentWork.shiftNumber < 2) {
            workQueue.push({ type: 'START_DUTY', blockName: blockKey, time: currentTime, shiftNumber: 2 });
        }
    } else {
        workQueue.push({ type: 'START_DUTY', blockName: blockKey, time: currentTime, shiftNumber: currentWork.shiftNumber });
    }
  }
  
  return { workBlockData, workBlockNames };
}
