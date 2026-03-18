import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('Sujata.db');
  }
  return db;
};

export const initDB = () => {
  const currentDb = getDB();
  try {
    const tables = [
      `CREATE TABLE IF NOT EXISTS Equipment (
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
      )`,
      `CREATE TABLE IF NOT EXISTS Maintenance_Schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        schedule_type TEXT NOT NULL,
        last_maintenance TEXT,
        next_maintenance TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Checklist_Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        routine_no TEXT,
        task_description TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES Maintenance_Schedule (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Maintenance_Log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        schedule_type TEXT,
        maintainer_name TEXT NOT NULL,
        remarks TEXT,
        maintenance_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'Completed',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Maintenance_Log_Items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id INTEGER NOT NULL,
        checklist_item_id INTEGER NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (log_id) REFERENCES Maintenance_Log (id),
        FOREIGN KEY (checklist_item_id) REFERENCES Checklist_Items (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Defects (
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
      )`,
      `CREATE TABLE IF NOT EXISTS Spare_Parts (
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
      )`,
      `CREATE TABLE IF NOT EXISTS Equipment_Spares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER,
        spare_id INTEGER,
        linked_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id),
        FOREIGN KEY (spare_id) REFERENCES Spare_Parts (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Spare_Usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spare_id INTEGER NOT NULL,
        equipment_id INTEGER,
        quantity_used INTEGER NOT NULL,
        maintainer_name TEXT,
        used_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (spare_id) REFERENCES Spare_Parts (id),
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Spare_Categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Staff',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS Vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS Equipment_Vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        vessel_id INTEGER NOT NULL,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id),
        FOREIGN KEY (vessel_id) REFERENCES Vessels (id)
      )`,
      `CREATE TABLE IF NOT EXISTS Troubleshooting_Guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER,
        category TEXT DEFAULT 'General',
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES Equipment (id)
      )`,
      `CREATE TABLE IF NOT EXISTS System_Settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`
    ];

    tables.forEach(sql => {
      try {
        currentDb.execSync(sql);
      } catch (e) {
        console.error('Table creation failed:', sql, e);
      }
    });

    // Seed Admin
    try {
      const adminExists = currentDb.getFirstSync<{ id: number }>('SELECT id FROM Users WHERE role = "Admin"');
      if (!adminExists) {
        currentDb.runSync(
          'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
          ['Sujata', '1234@qwer', 'Admin']
        );
      }
    } catch (e) {
      console.error('Seed error', e);
    }

    // Default Categories
    try {
      const dbCategories = currentDb.getAllSync<{ id: number }>('SELECT id FROM Spare_Categories LIMIT 1');
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
      { t: 'Defects', c: 'report_date', d: 'DATETIME' },
      { t: 'Equipment', c: 'maintained_by', d: 'TEXT' },
      { t: 'Equipment', c: 'maintenance_start_date', d: 'TEXT' },
      { t: 'Equipment', c: 'expected_completion_date', d: 'TEXT' },
      { t: 'Equipment', c: 'updated_at', d: 'DATETIME' },
      { t: 'Maintenance_Schedule', c: 'updated_at', d: 'DATETIME' },
      { t: 'Checklist_Items', c: 'updated_at', d: 'DATETIME' },
      { t: 'Maintenance_Log', c: 'updated_at', d: 'DATETIME' },
      { t: 'Maintenance_Log_Items', c: 'updated_at', d: 'DATETIME' },
      { t: 'Defects', c: 'updated_at', d: 'DATETIME' },
      { t: 'Spare_Parts', c: 'updated_at', d: 'DATETIME' },
      { t: 'Equipment_Spares', c: 'updated_at', d: 'DATETIME' },
      { t: 'Spare_Usage', c: 'updated_at', d: 'DATETIME' },
      { t: 'Checklist_Items', c: 'routine_no', d: 'TEXT' },
      { t: 'Troubleshooting_Guides', c: 'updated_at', d: 'DATETIME' },
    ];

    // Migration Helper
    const addColumnIfNeeded = (table: string, column: string, definition: string) => {
      try {
        // Use quotes for table name in PRAGMA
        const info = currentDb.getAllSync<any>(`PRAGMA table_info("${table}")`);
        const exists = info.some((col: any) => col.name === column);
        
        if (!exists) {
          console.log(`Migrating ${table}: Adding column ${column}`);
          // Use runSync for single statement and quote identifiers
          currentDb.runSync(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
          
          // If it's a timestamp column, initialize it for existing rows
          if (column === 'updated_at' || column === 'report_date') {
            currentDb.runSync(`UPDATE "${table}" SET "${column}" = datetime('now') WHERE "${column}" IS NULL`);
          }
          console.log(`Successfully added ${column} to ${table}`);
        }
      } catch (e: any) {
        console.error(`Migration failed for ${table}.${column}:`, e.message || e);
      }
    };

    tablesToAlter.forEach(item => {
      addColumnIfNeeded(item.t, item.c, item.d);
    });

    seedVessels(currentDb);
    seedEquipment(currentDb);

    // One-time cleanup: remove default "A/C PLANT" and "Main Deck" if they were seeded
    try {
      currentDb.runSync("UPDATE Equipment SET section = '', location = '' WHERE section = 'A/C PLANT' AND location = 'Main Deck'");
    } catch (e) {}

    // Verification - Optimized to run in a single go
    try {
      currentDb.execSync(`
        INSERT INTO Maintenance_Schedule (equipment_id, schedule_type)
        SELECT e.id, r.type
        FROM Equipment e
        CROSS JOIN (
          SELECT 'Daily' AS type UNION SELECT 'Weekly' UNION SELECT 'Monthly' 
          UNION SELECT 'Quarterly' UNION SELECT 'Yearly'
        ) r
        LEFT JOIN Maintenance_Schedule ms ON ms.equipment_id = e.id AND ms.schedule_type = r.type
        WHERE ms.id IS NULL
      `);
      console.log('Maintenance schedules verified and synchronized.');
    } catch (e: any) { 
      console.error('Schedule check error:', e.message || e);
    }

  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

const seedEquipment = (db: SQLite.SQLiteDatabase) => {
  const data = [
    { id: '572054', name: 'FANS FOR SAC VEN SYS', ships: ['INS VIKRAMADITYA'] },
    { id: '580012', name: 'MOTOR AIR CONDITIONER', ships: ['GOMATI'] },
    { id: '580016', name: 'MOTOR AIR CONDITIONER', ships: ['GOMATI'] },
    { id: '580034', name: 'MOTOR AIR CONDITIONER', ships: ['GOMATI'] },
    { id: '580148', name: 'MOTOR AIR FILTER UNIT', ships: ['GOMATI'] },
    { id: '580184', name: 'BILGE PUMP MOTOR (5.5KW)', ships: ['INS VIKRANT'] },
    { id: '580323', name: 'COOL ROOM FAN MOTOR', ships: ['INS SAGARDHWANI'] },
    { id: '580382', name: 'FAN MOTOR', ships: ['INS SAGARDHWANI'] },
    { id: '580383', name: 'MOTOR FAN', ships: ['INS SAGARDHWANI'] },
    { id: '581050', name: 'MOTOR ATU 5 TO 10 HP', ships: ['IMPHAL CELL', 'INS CHENNAI', 'INS DELHI', 'INS KOCHI', 'INS KOLKATA', 'INS MORMUGAO', 'INS MYSORE', 'INS VISAKHAPATNAM'] },
    { id: '581051', name: 'MOTOR ATU', ships: ['IMPHAL CELL', 'INS CHEETAH', 'INS CHENNAI', 'INS DELHI', 'INS KOCHI', 'INS KOLKATA', 'INS MORMUGAO', 'INS MYSORE', 'INS VISAKHAPATNAM'] },
    { id: '581065', name: 'MOTOR AIR FILTRATION UNIT', ships: ['INS BETWA', 'INS BRAHMAPUTRA'] },
    { id: '581066', name: 'EXHAUST MOTOR', ships: ['INS GULDAR'] },
    { id: '581067', name: 'E/R STBD BLOWER', ships: ['INS CHEETAH', 'INS GULDAR'] },
    { id: '581068', name: 'GALLEY EXHAUST MOTOR', ships: ['INS CHEETAH', 'INS GULDAR'] },
    { id: '581078', name: 'MOTOR ATU 3,4,5,8,10,11,12', ships: ['INS MUMBAI'] },
    { id: '584117', name: 'MOTOR VENTILATION', ships: ['GOMATI'] },
    { id: '584118', name: 'MOTOR AIR CONDITIONER', ships: ['GOMATI'] },
    { id: '584120', name: 'MOTOR VENTILATION', ships: ['GOMATI'] },
    { id: '584121', name: 'MOTOR VENTILATION', ships: ['GOMATI'] },
    { id: '584123', name: 'MOTOR VENTILATION', ships: ['GOMATI'] },
    { id: '584130', name: 'MOTOR (AHU)', ships: ['INS SARYU', 'INS SUMEDHA', 'INS SUMITRA', 'INS SUNAYNA'] },
    { id: '584131', name: 'MOTOR FAN COIL UNIT', ships: ['INS SAVITRI', 'INS SHAKTI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584132', name: 'MOTOR FAN COIL UNIT', ships: ['INS SAVITRI', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584133', name: 'MOTOR FAN COIL UNIT', ships: ['INS SAVITRI', 'INS SUBHADRA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584134', name: 'MOTOR VENTILATION', ships: ['INS SAVITRI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584135', name: 'MOTOR VENTILATION', ships: ['INS SAVITRI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584136', name: 'MOTOR VENTILATION', ships: ['INS SAVITRI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584137', name: 'MOTOR VENTILATION', ships: ['INS SAVITRI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584138', name: 'EXHAUST FAN', ships: ['INS JYOTI'] },
    { id: '584140', name: 'MOTOR VENTILATION', ships: ['INS SAVITRI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584141', name: 'MOTOR VENTILATION', ships: ['INS SAVITRI', 'INS SHARDA', 'INS SUBHADRA', 'INS SUJATA', 'INS SUKANYA', 'INS SUVARNA'] },
    { id: '584142', name: 'MOTOR', ships: ['INS SAGARDHWANI'] },
    { id: '584145', name: 'MOTOR AIR CONDITIONER', ships: ['GOMATI'] },
    { id: '584146', name: 'MOTOR (3 HP)', ships: ['INS BEAS', 'INS BETWA'] },
    { id: '587358', name: 'STARTER OF ATU\'S', ships: ['GOMATI'] },
    { id: '587367', name: 'STARTER OF HEAT EXCHANGER NO-11', ships: ['GOMATI'] },
    { id: '587368', name: 'STARTER OF HEAT EXCHANGER NO-32', ships: ['GOMATI'] },
    { id: '587369', name: 'STARTER OF HEAT EXCHANGER NO-48/20', ships: ['GOMATI'] },
    { id: '587392', name: 'STARTER FOR E/R BLOWER', ships: ['INS GAJ'] },
    { id: '587394', name: 'E/R BLOWER STARTER', ships: ['INS GAJ'] },
    { id: '58788', name: 'STARTER-MD BLOWER', ships: ['GOMATI'] }
  ];

  try {
    // Get all vessel IDs into a map for quick lookup
    const vessels = db.getAllSync<{ id: number, name: string }>('SELECT id, name FROM Vessels');
    const vesselMap = new Map(vessels.map(v => [v.name, v.id]));

    data.forEach(item => {
      // 1. Check if equipment already exists
      let equipId: number;
      const existing = db.getFirstSync<{ id: number }>('SELECT id FROM Equipment WHERE equipment_id = ?', [item.id]);

      if (existing) {
        equipId = existing.id;
      } else {
        // Insert new equipment with empty section/location as requested
        const result = db.runSync(
          'INSERT INTO Equipment (equipment_id, name, section, location, status) VALUES (?, ?, ?, ?, ?)',
          [item.id, item.name, '', '', 'Active']
        );
        equipId = result.lastInsertRowId;
        console.log(`Seeded equipment: ${item.name} (${item.id})`);
      }

      // 2. Link to vessels
      item.ships.forEach(shipName => {
        const vId = vesselMap.get(shipName);
        if (vId) {
          const linkExists = db.getFirstSync<{ id: number }>(
            'SELECT id FROM Equipment_Vessels WHERE equipment_id = ? AND vessel_id = ?',
            [equipId, vId]
          );
          if (!linkExists) {
            db.runSync('INSERT INTO Equipment_Vessels (equipment_id, vessel_id) VALUES (?, ?)', [equipId, vId]);
            console.log(`Linked ${item.id} to ${shipName}`);
          }
        }
      });
    });
  } catch (e) {
    console.error('Equipment seeding failed', e);
  }
};

const seedVessels = (db: SQLite.SQLiteDatabase) => {
  const vessels = [
    'GOMATI', 'INS VIKRAMADITYA', 'INS VIKRANT', 'INS SAGARDHWANI', 'INS BETWA',
    'INS BRAHMAPUTRA', 'INS GULDAR', 'INS CHEETAH', 'INS MUMBAI', 'INS SARYU',
    'INS SUMEDHA', 'INS SUMITRA', 'INS SUNAYNA', 'INS SAVITRI', 'INS SHAKTI',
    'INS SHARDA', 'INS SUBHADRA', 'INS SUKANYA', 'INS SUVARNA', 'INS JYOTI',
    'INS BEAS', 'INS GAJ', 'IMPHAL CELL', 'INS CHENNAI', 'INS DELHI', 'INS KOCHI',
    'INS KOLKATA', 'INS MORMUGAO', 'INS MYSORE', 'INS VISAKHAPATNAM', 'INS SUJATA'
  ];

  try {
    const existingVessels = db.getAllSync<{ name: string }>('SELECT name FROM Vessels');
    const existingNames = new Set(existingVessels.map((v: any) => v.name));

    vessels.forEach(name => {
      if (!existingNames.has(name)) {
        db.runSync('INSERT INTO Vessels (name, type) VALUES (?, ?)', [name, 'Ship']);
        console.log(`Seeded vessel: ${name}`);
      }
    });
  } catch (e) {
    console.error('Vessel seeding failed', e);
  }
};
