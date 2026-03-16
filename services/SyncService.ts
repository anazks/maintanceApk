import { getDB } from '../database';

export interface SyncData {
  version: string;
  timestamp: string;
  sourceDevice: string;
  payload: {
    [tableName: string]: any[];
  };
}

const TABLES_ORDER = [
  'Equipment',
  'Maintenance_Schedule',
  'Checklist_Items',
  'Maintenance_Log',
  'Maintenance_Log_Items',
  'Defects',
  'Spare_Parts',
  'Equipment_Spares',
  'Spare_Usage',
  'Users',
  'Vessels',
  'Equipment_Vessels'
];

export const SyncService = {
  /**
   * Exports all database content to a JSON payload.
   */
  exportData: async (deviceName: string): Promise<SyncData> => {
    const db = getDB();
    const payload: { [key: string]: any[] } = {};

    for (const table of TABLES_ORDER) {
      try {
        const rows = db.getAllSync(`SELECT * FROM ${table}`);
        payload[table] = rows;
      } catch (error) {
        console.warn(`Export failed for table ${table}:`, error);
        payload[table] = [];
      }
    }

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      sourceDevice: deviceName,
      payload
    };
  },

  /**
   * Merges incoming JSON data into the local database using "Last Updated Wins" logic.
   */
  importData: async (data: SyncData) => {
    const db = getDB();
    const { payload } = data;

    // Use a transaction for atomicity
    db.runSync('BEGIN TRANSACTION');

    try {
      for (const table of TABLES_ORDER) {
        const rows = payload[table];
        if (!rows || rows.length === 0) continue;

        for (const incomingRow of rows) {
          // Identify columns for this table
          const columns = Object.keys(incomingRow);
          const placeholders = columns.map(() => '?').join(', ');
          const values = Object.values(incomingRow);

          // We check if the record exists and if the incoming one is newer
          // For tables with a primary key 'id', we use that.
          // Note: Real delta sync should ideally use UUIDs for global uniqueness, 
          // but for this P2P local app, we'll try to match by ID or unique fields.
          
          let existingRow: any = null;
          try {
            // Priority unique fields for matching
            if (table === 'Equipment') {
              existingRow = db.getFirstSync('SELECT * FROM Equipment WHERE equipment_id = ?', [incomingRow.equipment_id]);
            } else if (table === 'Spare_Parts') {
              existingRow = db.getFirstSync('SELECT * FROM Spare_Parts WHERE part_number = ?', [incomingRow.part_number]);
            } else if (table === 'Users') {
              existingRow = db.getFirstSync('SELECT * FROM Users WHERE username = ?', [incomingRow.username]);
            } else if (incomingRow.id) {
              existingRow = db.getFirstSync(`SELECT * FROM ${table} WHERE id = ?`, [incomingRow.id]);
            }
          } catch (e) {}

          if (existingRow) {
            // Compare timestamps
            const incomingUpdate = new Date(incomingRow.updated_at || 0).getTime();
            const existingUpdate = new Date(existingRow.updated_at || 0).getTime();

            if (incomingUpdate > existingUpdate) {
              // Update existing record
              const setClause = columns.filter(c => c !== 'id').map(c => `${c} = ?`).join(', ');
              const updateValues = columns.filter(c => c !== 'id').map(c => incomingRow[c]);
              
              if (table === 'Equipment') {
                db.runSync(`UPDATE Equipment SET ${setClause} WHERE equipment_id = ?`, [...updateValues, incomingRow.equipment_id]);
              } else if (table === 'Spare_Parts') {
                db.runSync(`UPDATE Spare_Parts SET ${setClause} WHERE part_number = ?`, [...updateValues, incomingRow.part_number]);
              } else if (table === 'Users') {
                db.runSync(`UPDATE Users SET ${setClause} WHERE username = ?`, [...updateValues, incomingRow.username]);
              } else if (incomingRow.id) {
                db.runSync(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...updateValues, incomingRow.id]);
              }
            }
          } else {
            // Insert new record
            // We need to handle IDs carefully. If we use AUTOINCREMENT, 
            // the IDs might clash across devices.
            // For now, we'll strip the 'id' and let it auto-increment if it's a new record,
            // UNLESS it's a mapping table where IDs matter (but here they are mostly local).
            // A better production approach would use UUIDs.
            
            const insertCols = columns.filter(c => c !== 'id').join(', ');
            const insertPlaceholders = columns.filter(c => c !== 'id').map(() => '?').join(', ');
            const insertValues = columns.filter(c => c !== 'id').map(c => incomingRow[c]);

            db.runSync(`INSERT INTO ${table} (${insertCols}) VALUES (${insertPlaceholders})`, insertValues);
          }
        }
      }
      db.runSync('COMMIT');
    } catch (error) {
      db.runSync('ROLLBACK');
      console.error('Import failed, rolled back:', error);
      throw error;
    }
  }
};
