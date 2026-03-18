import * as FileSystem from 'expo-file-system/legacy';
import { getDB } from '../database';

const DB_NAME = 'Sujata.db';
const BACKUP_INTERVAL_DAYS = 15;

const getBackupDir = () => `${FileSystem.documentDirectory}Backups/`;

export const getBackupDirectory = async () => {
  const backupDir = getBackupDir();
  const dirInfo = await FileSystem.getInfoAsync(backupDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
  }
  return backupDir;
};

export const createDatabaseBackup = async () => {
  try {
    const dbDir = `${FileSystem.documentDirectory}SQLite/`;
    const sourceUri = `${dbDir}${DB_NAME}`;
    
    // Ensure backup directory exists
    const backupDir = await getBackupDirectory();

    const dateStr = new Date().toISOString().split('T')[0];
    const backupName = `Sujata_Backup_${dateStr}.db`;
    const destinationUri = `${backupDir}${backupName}`;

    // Check if source exists
    const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
    if (!sourceInfo.exists) {
      console.warn('Database file not found at:', sourceUri);
      return null;
    }

    // Copy the file
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    console.log('Database backed up to:', destinationUri);
    return destinationUri;
  } catch (error) {
    console.error('Backup failed:', error);
    return null;
  }
};

export const checkAndRunBackup = async () => {
  const db = getDB();
  try {
    const lastBackupResult = db.getFirstSync<{ value: string }>(
      'SELECT value FROM System_Settings WHERE key = ?',
      ['last_backup_date']
    );

    const now = new Date();
    let shouldBackup = false;

    if (!lastBackupResult) {
      shouldBackup = true;
    } else {
      const lastBackupDate = new Date(lastBackupResult.value);
      const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= BACKUP_INTERVAL_DAYS) {
        shouldBackup = true;
      }
    }

    if (shouldBackup) {
      console.log('Starting automated 15-day backup...');
      const backupUri = await createDatabaseBackup();
      if (backupUri) {
        // Update last backup date in DB
        db.runSync(
          'INSERT OR REPLACE INTO System_Settings (key, value) VALUES (?, ?)',
          ['last_backup_date', now.toISOString()]
        );
      }
    }
  } catch (error) {
    console.error('Error during automatic backup check:', error);
  }
};
