// src/utils/scheduler.jsx

const timeToMinutes = (time) => {
  if (!time || typeof time !== "string" || !time.includes(":")) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60) % 24;
  const mins = roundedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const formatDuration = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const generateFullDayTableData = (inputs) => {
  if (!inputs || !inputs.route) {
    return { headers: [], rows: [], allSchedules: [], dutySummaryData: [] };
  }

  const route = {
    ...inputs.route,
    upTurnoutKm: Number(inputs.route.upturnoutKm || inputs.route.upTurnoutKm || 0),
    downTurnoutKm: Number(inputs.route.downturnoutKm || inputs.route.downTurnoutKm || 0),
    upregularKm: Number(inputs.route.upregularKm || inputs.route.upregularkm || 0),
    downregularKm: Number(inputs.route.downregularKm || inputs.route.downregularkm || 0),
    timePerKm: Number(inputs.route.timePerKm || inputs.route.timeperkm || 0),
  };

  const { callingTime, numberOfBuses, breakLocation, peakHours, reducedHours } = inputs;
  const allSchedules = [];

  for (let busNum = 1; busNum <= numberOfBuses; busNum++) {
    const busStagger = ((busNum - 1) * ((route.upregularKm + route.downregularKm) * route.timePerKm)) / numberOfBuses;
    let lastSignOffTime = timeToMinutes(callingTime) + busStagger;

    for (let shiftNum = 1; shiftNum <= 2; shiftNum++) {
      const shiftHeader = `Bus ${busNum} - S${shiftNum}`;
      const shiftSchedule = [];
      const shiftCallingTime = shiftNum === 1 ? lastSignOffTime : lastSignOffTime + 15;

      const READY_TIME = 15,
        BREAK_DURATION = 30,
        DUTY_WORK_TIME = 480,
        MAX_WORK_BEFORE_BREAK = 240, // 4 hours
        MIN_WORK_BEFORE_BREAK = 150; // 2.5 hours

      let currentTime = shiftCallingTime,
        accumulatedWorkTime = 0,
        breakTaken = false,
        tripNumber = 1;

      shiftSchedule.push({ type: "event", name: "Calling Time", time: minutesToTime(currentTime) });
      currentTime += READY_TIME;
      accumulatedWorkTime += READY_TIME;
      shiftSchedule.push({ type: "event", name: "Ready", time: minutesToTime(currentTime) });

      const getTripDuration = (baseDuration, tripStartTime) => {
        let timeAdjustment = 0;
        (peakHours || []).forEach((peak) => {
          const appliesToThisBus = peak.bus === "All" || String(peak.bus) === String(busNum);
          if (appliesToThisBus && peak.startTime && peak.endTime && tripStartTime < timeToMinutes(peak.endTime) && tripStartTime + baseDuration > timeToMinutes(peak.startTime)) {
            timeAdjustment += Number(peak.extraTime || 0);
          }
        });
        (reducedHours || []).forEach((reduced) => {
          const appliesToThisBus = reduced.bus === "All" || String(reduced.bus) === String(busNum);
          if (appliesToThisBus && reduced.startTime && reduced.endTime && tripStartTime < timeToMinutes(reduced.endTime) && tripStartTime + baseDuration > timeToMinutes(reduced.startTime)) {
            timeAdjustment -= Number(reduced.reducedTime || 0);
          }
        });
        return baseDuration + timeAdjustment;
      };

      if (route.turnoutFromDepot) {
        const baseDuration = route.upTurnoutKm * route.timePerKm;
        const turnoutDuration = getTripDuration(baseDuration, currentTime);
        if (accumulatedWorkTime + turnoutDuration <= DUTY_WORK_TIME) {
          shiftSchedule.push({ type: "trip", tripNumber, startLocation: "Depot", endLocation: route.from, startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + turnoutDuration), duration: turnoutDuration, distance: route.upTurnoutKm });
          currentTime += turnoutDuration;
          accumulatedWorkTime += turnoutDuration;
          tripNumber++;
        }
      }

      let currentLocation = route.from;
      while (true) {
        const isUpTrip = currentLocation === route.from;
        const distance = isUpTrip ? route.upregularKm : route.downregularKm;
        const destination = isUpTrip ? route.to : route.from;
        const baseDuration = distance * route.timePerKm;
        const nextTripDuration = getTripDuration(baseDuration, currentTime);

        let returnToDepotDuration = 0;
        if (route.turnoutFromDepot) {
          const returnKm = destination === route.from ? route.upTurnoutKm : route.downTurnoutKm;
          returnToDepotDuration = returnKm * route.timePerKm;
        }

        if (accumulatedWorkTime + nextTripDuration + returnToDepotDuration > DUTY_WORK_TIME) {
          break;
        }

        // --- NEW "FORCED ROLES WITH TIERED PRIORITY" BREAK LOGIC ---
        let shouldTakeBreak = false;
        if (!breakTaken && currentLocation === breakLocation) {
            const workTimeAfterNextTrip = accumulatedWorkTime + nextTripDuration;

            // Rule 1 (Pioneer): Bus 1 has the highest priority to break early.
            if (busNum === 1 && accumulatedWorkTime >= MIN_WORK_BEFORE_BREAK) {
                shouldTakeBreak = true;
            }
            // Rule 2 (Mid-Shifter): Bus 2 has the next priority to break in the middle.
            else if (busNum === 2 && accumulatedWorkTime >= (MIN_WORK_BEFORE_BREAK + 45)) { // 3.25 hours
                shouldTakeBreak = true;
            }
            // Rule 3 (Absolute Failsafe): This applies to all other buses (3+) and is the
            // backup for buses 1 and 2. It forces a break if the 4-hour rule would be violated.
            else if (workTimeAfterNextTrip > MAX_WORK_BEFORE_BREAK) {
                shouldTakeBreak = true;
            }
        }
        // --- END OF NEW BREAK LOGIC ---

        if (shouldTakeBreak) {
          if (accumulatedWorkTime + BREAK_DURATION + returnToDepotDuration > DUTY_WORK_TIME) {
            break;
          }
          shiftSchedule.push({ type: "break", startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + BREAK_DURATION), duration: BREAK_DURATION, location: breakLocation });
          currentTime += BREAK_DURATION;
          accumulatedWorkTime += BREAK_DURATION;
          breakTaken = true;
          continue;
        }

        shiftSchedule.push({ type: "trip", tripNumber, startLocation: currentLocation, endLocation: destination, startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + nextTripDuration), duration: nextTripDuration, distance });
        currentTime += nextTripDuration;
        accumulatedWorkTime += nextTripDuration;
        currentLocation = destination;
        tripNumber++;
      }

      if (route.turnoutFromDepot) {
        const returnKm = currentLocation === route.from ? route.upTurnoutKm : route.downTurnoutKm;
        const baseDuration = returnKm * route.timePerKm;
        const returnDuration = getTripDuration(baseDuration, currentTime);
        if (accumulatedWorkTime + returnDuration <= DUTY_WORK_TIME) {
          shiftSchedule.push({ type: "trip", tripNumber, startLocation: currentLocation, endLocation: "Depot", startTime: minutesToTime(currentTime), endTime: minutesToTime(currentTime + returnDuration), duration: returnDuration, distance: returnKm });
          currentTime += returnDuration;
        }
      }

      shiftSchedule.push({ type: "event", name: "Sign Off", time: minutesToTime(currentTime) });
      allSchedules.push({ name: shiftHeader, schedule: shiftSchedule, route, busNum, shiftNum });
      lastSignOffTime = currentTime;
    }
  }

  allSchedules.sort((a, b) => {
    if (a.shiftNum !== b.shiftNum) return a.shiftNum - b.shiftNum;
    return a.busNum - b.busNum;
  });

  const headers = ["Event / Trip"];
  allSchedules.forEach(shift => headers.push(shift.name));

  const eventMap = new Map();
  allSchedules.forEach(({ name, schedule }) => {
    schedule.forEach((event) => {
      let eventKey, eventValue;
      if (event.type === "trip") {
        eventKey = `Trip ${event.tripNumber}: ${event.startLocation}`;
        eventValue = `${event.startTime.replace(":", ".")} (${Math.round(event.duration)}min)`;
      } else if (event.type === "break") {
        eventKey = "Break"; // Use a single key to group all breaks onto one row
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

  const unsortedRows = Array.from(eventMap.entries()).map(([eventName, times]) => ({ "Event / Trip": eventName, ...times }));

  let callingTimeRow, readyRow, signOffRow;
  const eventRows = [];
  unsortedRows.forEach((row) => {
    const eventName = row["Event / Trip"];
    if (eventName === "Calling Time") callingTimeRow = row;
    else if (eventName === "Ready") readyRow = row;
    else if (eventName === "Sign Off") signOffRow = row;
    else eventRows.push(row);
  });

  eventRows.sort((a, b) => {
    const getSortableTime = (row) => {
      const firstTimeValue = Object.values(row).find((val) => typeof val === "string" && (val.includes(":") || val.includes(".")));
      if (!firstTimeValue) return Infinity;
      const timePart = firstTimeValue.split("(")[0].split(" - ")[0].trim();
      const normalizedTime = timePart.replace(".", ":");
      return timeToMinutes(normalizedTime);
    };
    return getSortableTime(a) - getSortableTime(b);
  });

  const finalSortedRows = [];
  if (callingTimeRow) finalSortedRows.push(callingTimeRow);
  if (readyRow) finalSortedRows.push(readyRow);
  finalSortedRows.push(...eventRows);
  if (signOffRow) finalSortedRows.push(signOffRow);

  const dutySummaryData = [];
  allSchedules.forEach((shift) => {
    const callingTime = shift.schedule.find((e) => e.name === "Calling Time")?.time || "--";
    const shiftStart = shift.schedule.find((e) => e.name === "Ready")?.time || "--";
    const signOff = shift.schedule.find((e) => e.name === "Sign Off")?.time || "--";
    const breakEvent = shift.schedule.find((e) => e.type === "break");
    const totalDuration = formatDuration(timeToMinutes(signOff) - timeToMinutes(callingTime));

    if (breakEvent) {
      dutySummaryData.push({ busNo: shift.busNum, shiftNo: shift.shiftNum, callingTime: callingTime, shiftStart: shiftStart, workStart: shiftStart, workEnd: breakEvent.startTime, totalHours: totalDuration, isSecondRow: false });
      dutySummaryData.push({ busNo: shift.busNum, shiftNo: shift.shiftNum, callingTime: "--", shiftStart: "--", workStart: breakEvent.endTime, workEnd: signOff, totalHours: "--", isSecondRow: true });
    } else {
      dutySummaryData.push({ busNo: shift.busNum, shiftNo: shift.shiftNum, callingTime: callingTime, shiftStart: shiftStart, workStart: shiftStart, workEnd: signOff, totalHours: totalDuration, isSecondRow: false });
    }
  });

  return { headers, rows: finalSortedRows, allSchedules, dutySummaryData };
};

export default generateFullDayTableData;
