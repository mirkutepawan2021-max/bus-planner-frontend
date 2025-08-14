// src/utils/scheduler.jsx

const timeToMinutes = (time) => {
  if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60) % 24;
  const mins = roundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatDuration = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getTripDurationWithAdjustments = (baseDuration, tripStartTime, busNum, peakHours, reducedHours) => {
  let timeAdjustment = 0;
  (peakHours || []).forEach((peak) => {
    const appliesToThisBus = peak.bus === 'All' || String(peak.bus) === String(busNum);
    if (appliesToThisBus && peak.startTime && peak.endTime && tripStartTime < timeToMinutes(peak.endTime) && tripStartTime + baseDuration > timeToMinutes(peak.startTime)) {
      timeAdjustment += Number(peak.extraTime || 0);
    }
  });
  (reducedHours || []).forEach((reduced) => {
    const appliesToThisBus = reduced.bus === 'All' || String(reduced.bus) === String(busNum);
    if (appliesToThisBus && reduced.startTime && reduced.endTime && tripStartTime < timeToMinutes(reduced.endTime) && tripStartTime + baseDuration > timeToMinutes(reduced.startTime)) {
      timeAdjustment -= Number(reduced.reducedTime || 0);
    }
  });
  const finalDuration = baseDuration + timeAdjustment;
  return finalDuration > 0 ? finalDuration : 1;
};

const generateFullDayTableData = (inputs) => {
  if (!inputs || !inputs.route) {
    return { headers: [], rows: [], allSchedules: [], dutySummaryData: [] };
  }

  const numberOfBuses = Number(inputs.numberOfBuses || 0);
  if (isNaN(numberOfBuses) || numberOfBuses <= 0) {
    return { headers: [], rows: [], allSchedules: [], dutySummaryData: [] };
  }

  const generalTimePerKm = Number(inputs.route.timePerKm || inputs.route.timeperkm || 2);
  const uptimePerKmValue = Number(inputs.route.uptimePerKm || inputs.route.uptimeperkm);
  const downtimePerKmValue = Number(inputs.route.downtimePerKm || inputs.route.downtimeperkm);

  const route = {
    ...inputs.route,
    from: (inputs.route.from || 'Start').trim(),
    to: (inputs.route.to || 'End').trim(),
    upTurnoutKm: Number(inputs.route.upturnoutKm || inputs.route.upTurnoutKm || 0),
    downTurnoutKm: Number(inputs.route.downturnoutKm || inputs.route.downTurnoutKm || 0),
    upregularKm: Number(inputs.route.upkm || inputs.route.upregularKm || inputs.route.upregularkm || 0),
    downregularKm: Number(inputs.route.downkm || inputs.route.downregularKm || inputs.route.downregularkm || 0),
    uptimePerKm: uptimePerKmValue > 0 ? uptimePerKmValue : generalTimePerKm,
    downtimePerKm: downtimePerKmValue > 0 ? downtimePerKmValue : generalTimePerKm,
  };
  
  const breakLocation = (inputs.breakLocation || '').trim();

  // --- DEFINITIVE LOCATION FIX ---
  // Create normalized (lowercase) versions of locations for robust logical comparisons.
  const routeFromNormalized = route.from.toLowerCase();
  const routeToNormalized = route.to.toLowerCase();
  const breakLocationNormalized = breakLocation.toLowerCase();
  // --- END OF LOCATION FIX ---

  const { peakHours, reducedHours } = inputs;
  const allSchedules = [];

  for (let busNum = 1; busNum <= numberOfBuses; busNum++) {
    const avgRoundTripTime = (route.upregularKm * route.uptimePerKm) + (route.downregularKm * route.downtimePerKm);
    const busStagger = ((busNum - 1) * avgRoundTripTime) / numberOfBuses;
    let lastSignOffTime = timeToMinutes(inputs.callingTime) + busStagger;

    for (let shiftNum = 1; shiftNum <= 2; shiftNum++) {
      const shiftHeader = `Bus ${busNum} - S${shiftNum}`;
      const shiftSchedule = [];
      const shiftCallingTime = shiftNum === 1 ? lastSignOffTime : lastSignOffTime + 15;

      const READY_TIME = 15,
        BREAK_DURATION = 30,
        DUTY_WORK_TIME = 480,
        MAX_WORK_BEFORE_BREAK = 240,
        MIN_WORK_BEFORE_BREAK = 150;

      const NUM_BUSES_FOR_EARLY_BREAK = 2;
      const TRIPS_BEFORE_EARLY_BREAK = 4;

      let currentTime = shiftCallingTime,
        accumulatedWorkTime = 0,
        breakTaken = false,
        tripNumber = 1,
        revenueTripsCompleted = 0;

      shiftSchedule.push({ type: 'event', name: 'Calling Time', time: minutesToTime(currentTime) });
      currentTime += READY_TIME;
      accumulatedWorkTime += READY_TIME;
      shiftSchedule.push({ type: 'event', name: 'Ready', time: minutesToTime(currentTime) });

      if (route.turnoutFromDepot) {
        const baseDuration = route.upTurnoutKm * route.uptimePerKm; 
        const turnoutDuration = getTripDurationWithAdjustments(baseDuration, currentTime, busNum, peakHours, reducedHours);
        if (accumulatedWorkTime + turnoutDuration <= DUTY_WORK_TIME) {
          shiftSchedule.push({ type: 'trip', tripNumber, startLocation: 'Depot', endLocation: route.from, startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + turnoutDuration), duration: turnoutDuration, distance: route.upTurnoutKm });
          currentTime += turnoutDuration;
          accumulatedWorkTime += turnoutDuration;
          tripNumber++;
        }
      }

      let currentLocation = route.from;
      while (true) {
        // Use normalized locations for logic
        const isUpTrip = currentLocation.toLowerCase() === routeFromNormalized;
        const destination = isUpTrip ? route.to : route.from;
        
        const distance = isUpTrip ? route.upregularKm : route.downregularKm;
        const timePerKm = isUpTrip ? route.uptimePerKm : route.downtimePerKm;

        const baseDuration = distance * timePerKm;
        const nextTripDuration = getTripDurationWithAdjustments(baseDuration, currentTime, busNum, peakHours, reducedHours);

        let returnToDepotDuration = 0;
        if (route.turnoutFromDepot && destination.toLowerCase() === routeFromNormalized) {
          const returnKm = route.downTurnoutKm > 0 ? route.downTurnoutKm : route.upTurnoutKm;
          returnToDepotDuration = returnKm * route.downtimePerKm;
        }

        if (accumulatedWorkTime + nextTripDuration + returnToDepotDuration > DUTY_WORK_TIME) {
          break;
        }
        
        let shouldTakeBreak = false;
        if (!breakTaken && currentLocation.toLowerCase() === breakLocationNormalized) {
          const isEarlyBreakBus = busNum > numberOfBuses - NUM_BUSES_FOR_EARLY_BREAK;

          if (isEarlyBreakBus) {
            if (revenueTripsCompleted >= TRIPS_BEFORE_EARLY_BREAK && accumulatedWorkTime >= MIN_WORK_BEFORE_BREAK) {
              shouldTakeBreak = true;
            }
          } else {
            const workTimeAfterNextTrip = accumulatedWorkTime + nextTripDuration;
            if (workTimeAfterNextTrip > MAX_WORK_BEFORE_BREAK) {
              shouldTakeBreak = true;
            }
          }
        }

        if (shouldTakeBreak) {
          if (accumulatedWorkTime + BREAK_DURATION <= DUTY_WORK_TIME) {
            // Use original case for display
            shiftSchedule.push({ type: 'break', startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + BREAK_DURATION), duration: BREAK_DURATION, location: breakLocation });
            currentTime += BREAK_DURATION;
            accumulatedWorkTime += BREAK_DURATION;
            breakTaken = true;
            continue;
          } else {
            break;
          }
        }
        
        // Use original case for display
        shiftSchedule.push({ type: 'trip', tripNumber, startLocation: currentLocation, endLocation: destination, startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + nextTripDuration), duration: nextTripDuration, distance });
        currentTime += nextTripDuration;
        accumulatedWorkTime += nextTripDuration;
        currentLocation = destination;
        revenueTripsCompleted++;
        tripNumber++;
      }

      if (route.turnoutFromDepot && currentLocation.toLowerCase() === routeFromNormalized) {
        const returnKm = route.downTurnoutKm > 0 ? route.downTurnoutKm : route.upTurnoutKm;
        const baseDuration = returnKm * route.downtimePerKm;
        const returnDuration = getTripDurationWithAdjustments(baseDuration, currentTime, busNum, peakHours, reducedHours);
        if (accumulatedWorkTime + returnDuration <= DUTY_WORK_TIME) {
          shiftSchedule.push({ type: 'trip', tripNumber, startLocation: currentLocation, endLocation: 'Depot', startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + returnDuration), duration: returnDuration, distance: returnKm });
          currentTime += returnDuration;
        }
      }

      shiftSchedule.push({ type: 'event', name: 'Sign Off', time: minutesToTime(currentTime) });
      allSchedules.push({ name: shiftHeader, schedule: shiftSchedule, route, busNum, shiftNum });
      lastSignOffTime = currentTime;
    }
  }

  allSchedules.sort((a, b) => {
    if (a.shiftNum !== b.shiftNum) return a.shiftNum - b.shiftNum;
    return a.busNum - b.busNum;
  });

  const headers = ['Event / Trip'];
  allSchedules.forEach(shift => headers.push(shift.name));

  const eventMap = new Map();
  allSchedules.forEach(({ name, schedule }) => {
    schedule.forEach((event) => {
      let eventKey, eventValue;
      if (event.type === 'trip') {
        eventKey = `Trip ${event.tripNumber}: ${event.startLocation}`;
        eventValue = `${event.startTime.replace(':', '.')} (${Math.round(event.duration)}min)`;
      } else if (event.type === 'break') {
        eventKey = 'Break';
        eventValue = `${event.startTime} - ${event.endTime} (${Math.round(event.duration)} mins at ${event.location})`;
      } else {
        eventKey = event.name;
        eventValue = event.time;
      }
      if (!eventMap.has(eventKey)) {
        eventMap.set(eventKey, {});
      }
      eventMap.get(eventKey)[name] = eventValue;
    });
  });

  const unsortedRows = Array.from(eventMap.entries()).map(([eventName, times]) => ({ 'Event / Trip': eventName, ...times }));

  let callingTimeRow, readyRow, signOffRow;
  const eventRows = [];
  unsortedRows.forEach((row) => {
    const eventName = row['Event / Trip'];
    if (eventName === 'Calling Time') callingTimeRow = row;
    else if (eventName === 'Ready') readyRow = row;
    else if (eventName === 'Sign Off') signOffRow = row;
    else eventRows.push(row);
  });

  eventRows.sort((a, b) => {
    const getEarliestTime = (row) => {
      let earliestMinutes = Infinity;
      for (const key in row) {
        if (key === 'Event / Trip') continue;
        const value = row[key];
        if (typeof value === 'string' && (value.includes(':') || value.includes('.'))) {
          const timePart = value.split('(')[0].split('-')[0].trim();
          const normalizedTime = timePart.replace('.', ':');
          if (/^\d{1,2}:\d{2}$/.test(normalizedTime)) {
            const currentMinutes = timeToMinutes(normalizedTime);
            if (currentMinutes < earliestMinutes) {
              earliestMinutes = currentMinutes;
            }
          }
        }
      }
      return earliestMinutes;
    };
    return getEarliestTime(a) - getEarliestTime(b);
  });

  const finalSortedRows = [];
  if (callingTimeRow) finalSortedRows.push(callingTimeRow);
  if (readyRow) finalSortedRows.push(readyRow);
  finalSortedRows.push(...eventRows);
  if (signOffRow) finalSortedRows.push(signOffRow);

  const dutySummaryData = [];
  allSchedules.forEach((shift) => {
    const callingTime = shift.schedule.find(e => e.name === 'Calling Time')?.time || '--';
    const shiftStart = shift.schedule.find(e => e.name === 'Ready')?.time || '--';
    const signOff = shift.schedule.find(e => e.name === 'Sign Off')?.time || '--';
    const breakEvent = shift.schedule.find(e => e.type === 'break');
    const totalDuration = formatDuration(timeToMinutes(signOff) - timeToMinutes(callingTime));

    if (breakEvent) {
      dutySummaryData.push({ busNo: shift.busNum, shiftNo: shift.shiftNum, callingTime, shiftStart, workStart: shiftStart, workEnd: breakEvent.startTime, totalHours: totalDuration, isSecondRow: false });
      dutySummaryData.push({ busNo: shift.busNum, shiftNo: shift.shiftNum, callingTime: '--', shiftStart: '--', workStart: breakEvent.endTime, workEnd: signOff, totalHours: '--', isSecondRow: true });
    } else {
      dutySummaryData.push({ busNo: shift.busNum, shiftNo: shift.shiftNum, callingTime, shiftStart, workStart: shiftStart, workEnd: signOff, totalHours: totalDuration, isSecondRow: false });
    }
  });

  return { headers, rows: finalSortedRows, allSchedules, dutySummaryData };
};

export default generateFullDayTableData;