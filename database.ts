import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('sujatha.db');
  }
  return db;
};

export const initDB = () => {
  const currentDb = getDB();
  try {
    currentDb.execSync(`
      -- [Schema remains same, using currentDb instead of db]
      -- Equipment Table
      CREATE TABLE IF NOT EXISTS Equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        section TEXT NOT NULL,
        location TEXT NOT NULL,
        manufacturer TEXT,
        model_number TEXT,
        serial_number TEXT,
        installation_date TEXT,
        status TEXT DEFAULT 'Active',
        maintained_by TEXT,
        maintenance_start_date TEXT,
        expected_completion_date TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Maintenance Schedules
      CREATE TABLE IF NOT EXISTS Maintenance_Schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        schedule_type TEXT NOT NULL,
        last_maintenance TEXT,
        next_maintenance TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Checklist Items Library
      CREATE TABLE IF NOT EXISTS Checklist_Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        task_description TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES Maintenance_Schedule (id)
      );

      -- Maintenance Logs
      CREATE TABLE IF NOT EXISTS Maintenance_Log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        schedule_type TEXT,
        maintainer_name TEXT NOT NULL,
        remarks TEXT,
        maintenance_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'Completed',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Log Items
      CREATE TABLE IF NOT EXISTS Maintenance_Log_Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id INTEGER NOT NULL,
        checklist_item_id INTEGER NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (log_id) REFERENCES Maintenance_Log (id),
        FOREIGN KEY (checklist_item_id) REFERENCES Checklist_Items (id)
      );

      -- Defects Reporting
      CREATE TABLE IF NOT EXISTS Defects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        reported_by TEXT DEFAULT 'Inspector',
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium',
        corrective_action TEXT,
        status TEXT DEFAULT 'Open',
        report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Spare Parts Inventory
      CREATE TABLE IF NOT EXISTS Spare_Parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        part_number TEXT UNIQUE NOT NULL,
        category TEXT,
        minimum_quantity INTEGER DEFAULT 5,
        available_quantity INTEGER DEFAULT 0,
        price TEXT,
        location TEXT,
        keeper_name TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Equipment-Spare Parts Linking
      CREATE TABLE IF NOT EXISTS Equipment_Spares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER,
        spare_id INTEGER,
        linked_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id),
        FOREIGN KEY (spare_id) REFERENCES Spare_Parts (id)
      );

      -- Spare Parts Usage Log
      CREATE TABLE IF NOT EXISTS Spare_Usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spare_id INTEGER NOT NULL,
        equipment_id INTEGER,
        quantity_used INTEGER NOT NULL,
        maintainer_name TEXT,
        used_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (spare_id) REFERENCES Spare_Parts (id),
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Spare Categories
      CREATE TABLE IF NOT EXISTS Spare_Categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      -- Users Table
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Staff',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Vessels Table
      CREATE TABLE IF NOT EXISTS Vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Equipment-Vessels Linking
      CREATE TABLE IF NOT EXISTS Equipment_Vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        vessel_id INTEGER NOT NULL,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id),
        FOREIGN KEY (vessel_id) REFERENCES Vessels (id)
      );
    `);

    // Seed Admin
    try {
      const adminExists = currentDb.getFirstSync<{id: number}>('SELECT id FROM Users WHERE username = ?', ['sujatha']);
      if (!adminExists) {
        currentDb.runSync(
          'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
          ['sujatha', '1234@qwer', 'Admin']
        );
      }
    } catch (e) {
       console.error('Seed error', e);
    }

    // Default Categories
    try {
      const dbCategories = currentDb.getAllSync<{id: number}>('SELECT id FROM Spare_Categories LIMIT 1');
      if (dbCategories.length === 0) {
        currentDb.execSync(`
          INSERT INTO Spare_Categories (name) VALUES 
          ('Mechanical'), ('Electrical'), ('Consumables'), ('Tools')
        `);
      }
    } catch (e) { }
    
    // Migrations
    const tablesToAlter = [
      { t: 'Spare_Usage', c: 'maintainer_name', d: 'TEXT' },
      { t: 'Spare_Parts', c: 'keeper_name', d: 'TEXT' },
      { t: 'Equipment_Spares', c: 'linked_by', d: 'TEXT' },
      { t: 'Spare_Parts', c: 'date_added', d: "TEXT DEFAULT ''" },
      { t: 'Defects', c: 'reported_by', d: "TEXT DEFAULT 'Inspector'" },
      { t: 'Defects', c: 'priority', d: "TEXT DEFAULT 'Medium'" },
      { t: 'Defects', c: 'report_date', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Equipment', c: 'maintained_by', d: 'TEXT' },
      { t: 'Equipment', c: 'maintenance_start_date', d: 'TEXT' },
      { t: 'Equipment', c: 'expected_completion_date', d: 'TEXT' },
      { t: 'Equipment', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Maintenance_Schedule', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Checklist_Items', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Maintenance_Log', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Maintenance_Log_Items', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Defects', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Spare_Parts', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Equipment_Spares', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { t: 'Spare_Usage', c: 'updated_at', d: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    ];

    tablesToAlter.forEach(item => {
      try {
        currentDb.execSync(`ALTER TABLE ${item.t} ADD COLUMN ${item.c} ${item.d};`);
      } catch (e) { }
    });

    // Verification
    try {
      const equipments = currentDb.getAllSync<{id: number}>('SELECT id FROM Equipment');
      const routines = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
      const insertStmt = currentDb.prepareSync('INSERT INTO Maintenance_Schedule (equipment_id, schedule_type) VALUES (?, ?)');

      equipments.forEach(eq => {
        routines.forEach(type => {
          const existing = currentDb.getFirstSync<{id: number}>(
            'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
            [eq.id, type]
          );
          if (!existing) insertStmt.executeSync([eq.id, type]);
        });
      });
      insertStmt.finalizeSync();
    } catch (e) { }

  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};
