import * as SQLite from 'expo-sqlite';

// Open database synchronously (Expo SQLite API)
const db = SQLite.openDatabaseSync('maintenance.db');

export const initDB = () => {
  try {
    db.execSync(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Maintenance Schedules
      CREATE TABLE IF NOT EXISTS Maintenance_Schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        schedule_type TEXT NOT NULL, -- Daily, Weekly, Monthly, Quarterly, Yearly
        last_maintenance TEXT,
        next_maintenance TEXT,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Checklist Items Library
      CREATE TABLE IF NOT EXISTS Checklist_Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        task_description TEXT NOT NULL,
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
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Log Items (Individual checklist tick box results)
      CREATE TABLE IF NOT EXISTS Maintenance_Log_Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id INTEGER NOT NULL,
        checklist_item_id INTEGER NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
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
        priority TEXT DEFAULT 'Medium', -- Low, Medium, High, Critical
        corrective_action TEXT,
        status TEXT DEFAULT 'Open', -- Open, Under Repair, Closed
        report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Equipment-Spare Parts Linking (Many to Many)
      CREATE TABLE IF NOT EXISTS Equipment_Spares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER,
        spare_id INTEGER,
        linked_by TEXT,
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
        FOREIGN KEY (spare_id) REFERENCES Spare_Parts (id),
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      );

      -- Spare Categories
      CREATE TABLE IF NOT EXISTS Spare_Categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      -- Users Table for RBAC
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Staff', -- Admin, Staff
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Super Admin if not exists
    try {
      const adminExists = db.getFirstSync<{id: number}>('SELECT id FROM Users WHERE username = ?', ['sujatha']);
      if (!adminExists) {
        db.runSync(
          'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
          ['sujatha', '1234@qwer', 'Admin']
        );
        console.log('Super Admin seeded successfully');
      }
    } catch (e) {
      console.error('Failed to seed super admin', e);
    }

    // Insert Default Categories if none exist
    try {
      const dbCategories = db.getAllSync<{id: number}>('SELECT id FROM Spare_Categories LIMIT 1');
      if (dbCategories.length === 0) {
        db.execSync(`
          INSERT INTO Spare_Categories (name) VALUES 
          ('Mechanical'),
          ('Electrical'),
          ('Consumables'),
          ('Tools')
        `);
      }
    } catch (e) {
      console.error('Failed to initialize default categories', e);
    }
    
    try {
      db.execSync('ALTER TABLE Spare_Usage ADD COLUMN maintainer_name TEXT;');
    } catch (e) {
      // Column already exists
    }

    try {
      db.execSync('ALTER TABLE Spare_Parts ADD COLUMN keeper_name TEXT;');
    } catch (e) {
      // Column already exists
    }

    try {
      db.execSync('ALTER TABLE Equipment_Spares ADD COLUMN linked_by TEXT;');
    } catch (e) {
      // Column already exists
    }

    try {
      db.execSync("ALTER TABLE Spare_Parts ADD COLUMN date_added TEXT DEFAULT '';");
    } catch (e) {
      // Column already exists
    }

    try {
      db.execSync(`
        DELETE FROM Spare_Parts WHERE name IN ('Ceramic Bearings', 'Cooling Fluid', 'Control Board');
      `);
    } catch (e) {
      // Ignored
    }

    try {
      db.execSync('ALTER TABLE Defects ADD COLUMN reported_by TEXT DEFAULT \'Inspector\';');
    } catch (e) { /* Column already exists */ }

    try {
      db.execSync('ALTER TABLE Defects ADD COLUMN priority TEXT DEFAULT \'Medium\';');
    } catch (e) { /* Column already exists */ }

    try {
      db.execSync('ALTER TABLE Defects ADD COLUMN report_date DATETIME DEFAULT CURRENT_TIMESTAMP;');
    } catch (e) { /* Column already exists */ }

    // Ensure all Equipment have all 5 routine types in Maintenance_Schedule
    try {
      const equipments = db.getAllSync<{id: number}>('SELECT id FROM Equipment');
      const routines = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
      
      const insertStmt = db.prepareSync('INSERT INTO Maintenance_Schedule (equipment_id, schedule_type) VALUES (?, ?)');

      equipments.forEach(eq => {
        routines.forEach(type => {
          const existing = db.getFirstSync<{id: number}>(
            'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
            [eq.id, type]
          );
          if (!existing) {
            insertStmt.executeSync([eq.id, type]);
          }
        });
      });
      
      insertStmt.finalizeSync();
      console.log('Routine slots verified for all equipment');
    } catch (e) {
      console.error('Failed to backfill routine slots:', e);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const getDB = () => db;
