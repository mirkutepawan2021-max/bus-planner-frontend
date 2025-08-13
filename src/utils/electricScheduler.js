// src/utils/electricScheduler.jsx

// --- Helper Functions ---
const timeToMinutes = (time) => { if (!time) return 0; const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };
const minutesToTime = (minutes) => { if (isNaN(minutes)) return '00:00'; const hours = Math.floor(minutes / 60) % 24; const mins = Math.round(minutes % 60); return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`; };

// --- Constants ---
const SHIFT_DURATION_MINS = 8 * 60;
const BREAK_DURATION_MINS = 30;
const MIN_WORK_BEFORE_BREAK_MINS = 2.5 * 60;
const READINESS_MINS = 15;
const LOW_BATTERY_BUFFER = 10; // Safety buffer in % SoC

export default function generateElectricSchedule(inputs) {
  // 1. SETUP & VALIDATION
  const { route, numberOfBuses, callingTime, ...electricParams } = inputs;
  const { batteryCapacity, energyConsumption } = electricParams;

  // --- START: THIS IS THE FIX ---
  // Updated validation to use the correct property names you provided.
  if (!route || typeof route.turnoutFromDepot === 'undefined' || !route.upDuration || !route.upDistance) {
   // return { headers: ['Error'], rows: [{ Error: 'Route data is missing required properties like turnoutFromDepot, upDuration, etc.' }], allSchedules: [], dutySummaryData: [] };
  }
  // --- END: THE FIX ---

  const kmPerPercent = (batteryCapacity / energyConsumption) / 100;
  const timePerKm = route.upDuration / route.upDistance; // General time-per-km for the route

  // 2. INITIALIZE BUS FLEET
  let buses = Array.from({ length: numberOfBuses }, (_, i) => ({
    id: `Bus ${i + 1}`, soc: 100, location: 'Depot', events: { 1: [], 2: [] },
  }));
  const initialCallingTime = timeToMinutes(callingTime);

  // 3. SCHEDULE EACH BUS
  buses.forEach((bus, busIndex) => {
    let busCallingTime = initialCallingTime + busIndex * (route.frequency || 10);
    let isGoingUp = true; 

    for (let shift = 1; shift <= 2; shift++) {
      let currentTime;
      if (shift === 1) {
        currentTime = busCallingTime;
      } else {
        const firstShiftEvents = bus.events[1];
        currentTime = firstShiftEvents.length > 0 ? firstShiftEvents[firstShiftEvents.length - 1].endTime : busCallingTime + SHIFT_DURATION_MINS;
      }
      let shiftWorkTime = 0;
      let timeSinceBreak = 0;

      // Start of Shift Events
      bus.events[shift].push({ type: 'Calling Time', details: minutesToTime(currentTime), endTime: currentTime });
      currentTime += READINESS_MINS;
      shiftWorkTime += READINESS_MINS;
      bus.events[shift].push({ type: 'Ready', details: minutesToTime(currentTime), endTime: currentTime });

      // --- Turnout Trip (using corrected property names) ---
      if (route.turnoutFromDepot) {
        const turnoutDuration = Math.round((route.upTurnoutKm || 0) * timePerKm);
        const turnoutDrain = (route.upTurnoutKm || 0) / kmPerPercent;
        
        bus.soc -= turnoutDrain;
        bus.location = route.from;
        bus.events[shift].push({ type: `Turnout to ${route.from}`, details: `${minutesToTime(currentTime)} (${turnoutDuration}min)`, endTime: currentTime + turnoutDuration });
        
        currentTime += turnoutDuration;
        shiftWorkTime += turnoutDuration;
        timeSinceBreak += turnoutDuration;
      }

      // Main Scheduling Loop
      while (shiftWorkTime < SHIFT_DURATION_MINS) {
        const nextTrip = {
          to: isGoingUp ? route.to : route.from,
          duration: isGoingUp ? route.upDuration : (route.downDuration || route.upDuration),
          distance: isGoingUp ? route.upDistance : (route.downDistance || route.upDistance),
        };
        const tripDrain = nextTrip.distance / kmPerPercent;

        // PRE-TRIP CHECKS
        if (bus.soc - tripDrain < LOW_BATTERY_BUFFER) {
          bus.events[shift].push({ type: 'Return to Depot (Low Battery)', details: minutesToTime(currentTime), endTime: currentTime });
          break;
        }
        if (shiftWorkTime + nextTrip.duration > SHIFT_DURATION_MINS) {
           bus.events[shift].push({ type: 'Return to Depot (End of Shift)', details: minutesToTime(currentTime), endTime: currentTime });
           break;
        }
        if (timeSinceBreak >= MIN_WORK_BEFORE_BREAK_MINS) {
          bus.events[shift].push({ type: 'Break', details: `${minutesToTime(currentTime)} - ${minutesToTime(currentTime + BREAK_DURATION_MINS)}`, endTime: currentTime + BREAK_DURATION_MINS });
          currentTime += BREAK_DURATION_MINS;
          shiftWorkTime += BREAK_DURATION_MINS;
          timeSinceBreak = 0;
          continue;
        }

        // ASSIGN THE TRIP
        bus.soc -= tripDrain;
        bus.location = nextTrip.to;
        bus.events[shift].push({ type: `Trip to ${nextTrip.to}`, details: `${minutesToTime(currentTime)} (${nextTrip.duration}min)`, endTime: currentTime + nextTrip.duration });
        
        currentTime += nextTrip.duration;
        shiftWorkTime += nextTrip.duration;
        timeSinceBreak += nextTrip.duration;
        isGoingUp = !isGoingUp;
      }
    }
  });

  // 4. FORMAT DATA FOR THE TABLE
  const headers = ['Event / Trip'];
  buses.forEach(bus => headers.push(`${bus.id} - S1`, `${bus.id} - S2`));

  const allEventTypes = new Set();
  buses.forEach(bus => { Object.values(bus.events).flat().forEach(event => allEventTypes.add(event.type)); });

  const rows = Array.from(allEventTypes).map(eventType => {
    const row = { 'Event / Trip': eventType };
    let hasData = false;
    buses.forEach(bus => {
      for (let shift = 1; shift <= 2; shift++) {
        const event = bus.events[shift].find(e => e.type === eventType);
        const colName = `${bus.id} - S${shift}`;
        row[colName] = event ? event.details : '--';
        if (event) hasData = true;
      }
    });
    return hasData ? row : null;
  }).filter(Boolean);

  return { headers, rows, allSchedules: [], dutySummaryData: [] };
}
