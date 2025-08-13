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
  if (!inputs || !inputs.route)
    return { headers: [], rows: [], allSchedules: [], dutySummaryData: [] };
  
  // --- CHANGE 1: Update how the route object is created ---
  const route = {
    ...inputs.route,
    upTurnoutKm: Number(
      inputs.route.upturnoutKm || inputs.route.upTurnoutKm || 0
    ),
    downTurnoutKm: Number(
      inputs.route.downturnoutKm || inputs.route.downTurnoutKm || 0
    ),
    upregularKm: Number(
      inputs.route.upregularKm || inputs.route.upregularkm || 0
    ),
    downregularKm: Number(
      inputs.route.downregularKm || inputs.route.downregularkm || 0
    ),
    // Remove old timePerKm and add the new fields with fallbacks
    uptimePerKm: Number(inputs.route.uptimePerKm || inputs.route.uptimeperkm || 0),
    downtimePerKm: Number(inputs.route.downtimePerKm || inputs.route.downtimeperkm || 0),
  };
  // --- END OF CHANGE 1 ---

  const { callingTime, numberOfBuses, breakLocation, peakHours, reducedHours } =
    inputs;

  const allSchedules = [];
  const headers = ["Event / Trip"];

  for (let busNum = 1; busNum <= numberOfBuses; busNum++) {
    // --- CHANGE 2: Update stagger calculation with new fields ---
    const roundTripDuration = (route.upregularKm * route.uptimePerKm) + (route.downregularKm * route.downtimePerKm);
    const busStagger = ((busNum - 1) * roundTripDuration) / numberOfBuses;
    // --- END OF CHANGE 2 ---

    let lastSignOffTime = timeToMinutes(callingTime) + busStagger;

    for (let shiftNum = 1; shiftNum <= 2; shiftNum++) {
      const shiftHeader = `Bus ${busNum} - S${shiftNum}`;
      headers.push(shiftHeader);

      const shiftSchedule = [];
      const shiftCallingTime =
        shiftNum === 1 ? lastSignOffTime : lastSignOffTime + 15;

      const READY_TIME = 15,
        BREAK_DURATION = 30,
        DUTY_WORK_TIME = 480,
        MAX_WORK_BEFORE_BREAK = 240,
        MIN_WORK_BEFORE_BREAK = 150;

      const NO_BREAK_START = timeToMinutes("07:00"),
        NO_BREAK_END = timeToMinutes("11:00"),
        MIN_WORK_FOR_EARLY_BREAK = 90;

      let currentTime = shiftCallingTime,
        accumulatedWorkTime = 0,
        breakTaken = false,
        tripNumber = 1;

      shiftSchedule.push({
        type: "event",
        name: "Calling Time",
        time: minutesToTime(currentTime),
      });

      currentTime += READY_TIME;
      accumulatedWorkTime += READY_TIME;

      shiftSchedule.push({
        type: "event",
        name: "Ready",
        time: minutesToTime(currentTime),
      });

      const getTripDuration = (baseDuration, tripStartTime) => {
        let timeAdjustment = 0;
        (peakHours || []).forEach((peak) => {
          const appliesToThisBus =
            peak.bus === "All" || String(peak.bus) === String(busNum);
          if (
            appliesToThisBus &&
            peak.startTime &&
            peak.endTime &&
            tripStartTime < timeToMinutes(peak.endTime) &&
            tripStartTime + baseDuration > timeToMinutes(peak.startTime)
          ) {
            timeAdjustment += Number(peak.extraTime || 0);
          }
        });
        (reducedHours || []).forEach((reduced) => {
          const appliesToThisBus =
            reduced.bus === "All" || String(reduced.bus) === String(busNum);
          if (
            appliesToThisBus &&
            reduced.startTime &&
            reduced.endTime &&
            tripStartTime < timeToMinutes(reduced.endTime) &&
            tripStartTime + baseDuration > timeToMinutes(reduced.startTime)
          ) {
            timeAdjustment -= Number(reduced.reducedTime || 0);
          }
        });
        return baseDuration + timeAdjustment;
      };
      
      if (route.turnoutFromDepot) {
        // --- CHANGE 3: Use uptimePerKm for turnout trip ---
        const baseDuration = route.upTurnoutKm * route.uptimePerKm;
        // --- END OF CHANGE 3 ---
        const turnoutDuration = getTripDuration(baseDuration, currentTime);
        if (accumulatedWorkTime + turnoutDuration <= DUTY_WORK_TIME) {
          shiftSchedule.push({
            type: "trip",
            tripNumber,
            startLocation: "Depot",
            endLocation: route.from,
            startTime: minutesToTime(currentTime),
            endTime: minutesToTime(currentTime + turnoutDuration),
            duration: turnoutDuration,
            distance: route.upTurnoutKm,
          });
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

        // --- CHANGE 4: Use the correct timePerKm based on trip direction ---
        const timePerKmForTrip = isUpTrip ? route.uptimePerKm : route.downtimePerKm;
        const baseDuration = distance * timePerKmForTrip;
        // --- END OF CHANGE 4 ---

        const nextTripDuration = getTripDuration(baseDuration, currentTime);

        let returnToDepotDuration = 0;
        if (route.turnoutFromDepot) {
          const returnKm =
            destination === route.from
              ? route.upTurnoutKm
              : route.downTurnoutKm;
          // --- CHANGE 5: Use correct timePerKm for return to depot calculation ---
          const timePerKmForReturn = (destination === route.from) ? route.uptimePerKm : route.downtimePerKm;
          returnToDepotDuration = returnKm * timePerKmForReturn;
          // --- END OF CHANGE 5 ---
        }
        
        if (
          accumulatedWorkTime + nextTripDuration + returnToDepotDuration >
          DUTY_WORK_TIME
        )
          break;

        let shouldTakeBreak = false;
        if (!breakTaken && currentLocation === breakLocation) {
          const isMandatoryBreak =
            accumulatedWorkTime + nextTripDuration > MAX_WORK_BEFORE_BREAK;
          const isOptimalTime =
            accumulatedWorkTime >= MIN_WORK_BEFORE_BREAK &&
            accumulatedWorkTime < MAX_WORK_BEFORE_BREAK;
          const hasWorkedEnoughForEarlyBreak =
            accumulatedWorkTime >= MIN_WORK_FOR_EARLY_BREAK;
          const willEnterNoBreakZone =
            currentTime < NO_BREAK_START &&
            currentTime + nextTripDuration >= NO_BREAK_START;
          const isForcedEarlyBreak =
            willEnterNoBreakZone && hasWorkedEnoughForEarlyBreak;
          const wouldBreakInZone =
            currentTime >= NO_BREAK_START && currentTime < NO_BREAK_END;

          if (isMandatoryBreak) {
            shouldTakeBreak = true;
          } else if (isOptimalTime || isForcedEarlyBreak) {
            if (!wouldBreakInZone) {
              shouldTakeBreak = true;
            }
          }
        }

        if (shouldTakeBreak) {
          if (
            accumulatedWorkTime + BREAK_DURATION + returnToDepotDuration >
            DUTY_WORK_TIME
          )
            break;

          shiftSchedule.push({
            type: "break",
            startTime: minutesToTime(currentTime),
            endTime: minutesToTime(currentTime + BREAK_DURATION),
            duration: BREAK_DURATION,
            location: breakLocation,
          });
          currentTime += BREAK_DURATION;
          accumulatedWorkTime += BREAK_DURATION;
          breakTaken = true;
          continue;
        }

        shiftSchedule.push({
          type: "trip",
          tripNumber,
          startLocation: currentLocation,
          endLocation: destination,
          startTime: minutesToTime(currentTime),
          endTime: minutesToTime(currentTime + nextTripDuration),
          duration: nextTripDuration,
          distance,
        });

        currentTime += nextTripDuration;
        accumulatedWorkTime += nextTripDuration;
        currentLocation = destination;
        tripNumber++;
      }
      
      if (route.turnoutFromDepot) {
        const returnKm =
          currentLocation === route.from
            ? route.upTurnoutKm
            : route.downTurnoutKm;
        // --- CHANGE 6: Use correct timePerKm for final return trip ---
        const timePerKmForFinalReturn = (currentLocation === route.from) ? route.uptimePerKm : route.downtimePerKm;
        const baseDuration = returnKm * timePerKmForFinalReturn;
        // --- END OF CHANGE 6 ---
        const returnDuration = getTripDuration(baseDuration, currentTime);

        if (accumulatedWorkTime + returnDuration <= DUTY_WORK_TIME) {
          shiftSchedule.push({
            type: "trip",
            tripNumber,
            startLocation: currentLocation,
            endLocation: "Depot",
            startTime: minutesToTime(currentTime),
            endTime: minutesToTime(currentTime + returnDuration),
            duration: returnDuration,
            distance: returnKm,
          });
          currentTime += returnDuration;
        }
      }

      shiftSchedule.push({
        type: "event",
        name: "Sign Off",
        time: minutesToTime(currentTime),
      });

      allSchedules.push({
        name: shiftHeader,
        schedule: shiftSchedule,
        route,
        busNum,
        shiftNum,
      });
      lastSignOffTime = currentTime;
    }
  }

  const eventMap = new Map();
  allSchedules.forEach(({ name, schedule }) => {
    schedule.forEach((event) => {
      let eventKey, eventValue;
      if (event.type === "trip") {
        eventKey = `Trip ${event.tripNumber}: ${event.startLocation}`;
        eventValue = `${event.startTime.replace(":", ".")} (${Math.round(
          event.duration
        )}min)`;
      } else if (event.type === "break") {
        eventKey = "Break";
        eventValue = `${event.startTime} - ${event.endTime} (${Math.round(
          event.duration
        )} mins at ${event.location})`;
      } else {
        eventKey = event.name;
        eventValue = event.time;
      }
      if (!eventMap.has(eventKey)) eventMap.set(eventKey, {});
      eventMap.get(eventKey)[name] = eventValue;
    });
  });

  const unsortedRows = Array.from(eventMap.entries()).map(
    ([eventName, times]) => ({ "Event / Trip": eventName, ...times })
  );

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
      const firstTimeValue = Object.values(row).find(
        (val) =>
          typeof val === "string" && (val.includes(":") || val.includes("."))
      );
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
    const callingTime =
      shift.schedule.find((e) => e.name === "Calling Time")?.time || "--";
    const shiftStart =
      shift.schedule.find((e) => e.name === "Ready")?.time || "--";
    const signOff =
      shift.schedule.find((e) => e.name === "Sign Off")?.time || "--";
    const breakEvent = shift.schedule.find((e) => e.type === "break");
    const totalDuration = formatDuration(
      timeToMinutes(signOff) - timeToMinutes(callingTime)
    );

    if (breakEvent) {
      dutySummaryData.push({
        busNo: shift.busNum,
        shiftNo: shift.shiftNum,
        callingTime: callingTime,
        shiftStart: shiftStart,
        workStart: shiftStart,
        workEnd: breakEvent.startTime,
        totalHours: totalDuration,
        isSecondRow: false,
      });
      dutySummaryData.push({
        busNo: shift.busNum,
        shiftNo: shift.shiftNum,
        callingTime: "--",
        shiftStart: "--",
        workStart: breakEvent.endTime,
        workEnd: signOff,
        totalHours: "--",
        isSecondRow: true,
      });
    } else {
      dutySummaryData.push({
        busNo: shift.busNum,
        shiftNo: shift.shiftNum,
        callingTime: callingTime,
        shiftStart: shiftStart,
        workStart: shiftStart,
        workEnd: signOff,
        totalHours: totalDuration,
        isSecondRow: false,
      });
    }
  });

  return { headers, rows: finalSortedRows, allSchedules, dutySummaryData };
};

export default generateFullDayTableData;
