// src/utils/electric/electricDataFormatter.js

const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/^(\d{2}:\d{2})/);
    if (!match) return 0;
    const [hours, mins] = match[1].split(':').map(Number);
    return hours * 60 + mins;
};

/**
 * Formats clean simulation data into tables for the UI, ensuring chronological order.
 */
export default function formatElectricScheduleData({ workBlockData, workBlockNames, route }) {
    if (!workBlockData) {
        return { headers: [], rows: [], allSchedules: [], dutySummaryData: [] };
    }

    const eventTimestamps = {};
    Object.values(workBlockData).forEach(data => {
        let tripCounter = 0;
        (data.events || []).forEach(event => {
            let eventKey;
            if (event.type === 'Trip') {
                if (event.description.startsWith(route.from)) {
                    tripCounter++;
                }
                eventKey = `Trip ${tripCounter} (${event.description})`;
            } else {
                eventKey = event.type;
            }
            const eventTime = timeToMinutes(event.time);
            if (!eventTimestamps[eventKey] || eventTime < eventTimestamps[eventKey]) {
                eventTimestamps[eventKey] = eventTime;
            }
        });
    });

    const sortedEventKeys = Object.keys(eventTimestamps).sort((a, b) => eventTimestamps[a] - eventTimestamps[b]);

    const scheduleMatrix = {};
    Object.entries(workBlockData).forEach(([blockName, data]) => {
        let tripCounter = 0;
        (data.events || []).forEach(event => {
            let eventKey;
            if (event.type === 'Trip') {
                if (event.description.startsWith(route.from)) { tripCounter++; }
                eventKey = `Trip ${tripCounter} (${event.description})`;
            } else { eventKey = event.type; }

            if (!scheduleMatrix[eventKey]) { scheduleMatrix[eventKey] = { 'Event': eventKey }; }
            
            scheduleMatrix[eventKey][blockName] = event.type === 'Trip' ? event.time : `${event.time} (${event.bus})`;
        });
    });
    
    const headers = ['Event', ...(workBlockNames || [])];
    const rows = sortedEventKeys.map(key => {
        const row = scheduleMatrix[key] || { 'Event': key };
        (workBlockNames || []).forEach(col => { if (!row[col]) row[col] = '--'; });
        return row;
    });

    const allSchedules = (workBlockNames || []).map(name => ({
        name: name,
        ...(workBlockData[name] || { events: [], totalKm: 0, totalHours: 0 }),
    }));

    const dutySummaryData = (workBlockNames || []).map(name => ({
        duty: name,
        totalHours: (workBlockData[name]?.totalHours || 0).toFixed(2),
        totalKm: (workBlockData[name]?.totalKm || 0).toFixed(2),
        bus: 'Multiple',
    }));

    return { headers, rows, allSchedules, dutySummaryData };
}
