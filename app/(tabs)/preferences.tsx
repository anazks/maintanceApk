import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getDB } from '../../database';
import { ReportUtils } from '../../utils/ReportUtils';

export default function Preferences() {
  const { theme, isDarkMode } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [autoSync, setAutoSync] = useState(true);
  const [staffList, setStaffList] = useState<{ id: number; username: string; role: string }[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState(user?.username || '');
  const [adminPassword, setAdminPassword] = useState('');

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    if (isAdmin) {
      loadStaff();
    }
  }, [isAdmin]);

  const loadStaff = () => {
    const db = getDB();
    try {
      const staff = db.getAllSync<{ id: number; username: string; role: string }>(
        'SELECT id, username, role FROM Users WHERE role = "Staff"'
      );
      setStaffList(staff);
    } catch (e) {
      console.error(e);
    }
  };

  const addStaff = () => {
    if (!newStaffUsername.trim() || !newStaffPassword.trim()) return;
    const db = getDB();
    try {
      db.runSync(
        'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
        [newStaffUsername.trim(), newStaffPassword.trim(), 'Staff']
      );
      setNewStaffUsername('');
      setNewStaffPassword('');
      setShowAddStaffModal(false);
      loadStaff();
      Alert.alert('Success', 'Staff member added successfully');
    } catch (e) {
      Alert.alert('Error', 'Username already exists or failed to add staff');
    }
  };

  const updateAdminAccount = () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      Alert.alert('Required', 'Please enter both new username and password.');
      return;
    }

    const db = getDB();
    try {
      if (!user?.id) throw new Error('User session not found');
      
      db.runSync(
        'UPDATE Users SET username = ?, password = ? WHERE id = ?',
        [adminUsername.trim(), adminPassword.trim(), user.id]
      );
      
      Alert.alert('Success', 'Admin credentials updated. Please log in again.', [
        { text: 'OK', onPress: handleLogout }
      ]);
      setShowAccountModal(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update credentials. Username might be taken.');
    }
  };

  const deleteStaff = (id: number) => {
    Alert.alert('Remove Staff', 'Are you sure you want to remove this staff member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          const db = getDB();
          try {
            db.runSync('DELETE FROM Users WHERE id = ?', [id]);
            loadStaff();
          } catch (e) { Alert.alert('Error', 'Failed to delete staff'); }
        }
      }
    ]);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/Login');
  };

  const handleExport = async (type: 'equipment' | 'maintenance' | 'spares', format: 'csv' | 'pdf') => {
    let data: any[] = [];
    let title = '';

    if (type === 'equipment') {
      data = ReportUtils.getEquipmentReport();
      title = 'Equipment Inventory Report';
    } else if (type === 'maintenance') {
      data = ReportUtils.getMaintenanceReport();
      title = 'Maintenance History Report';
    } else if (type === 'spares') {
      data = ReportUtils.getSparesReport();
      title = 'Spare Parts Inventory Report';
    }

    if (format === 'csv') {
      await ReportUtils.downloadCSV(title, data);
    } else {
      await ReportUtils.downloadPDF(title, data);
    }
  };

  const handleExportDatabase = async () => {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/Sujata.db`;
      const info = await FileSystem.getInfoAsync(dbPath);

      if (!info.exists) {
        Alert.alert('Error', 'Database file not found.');
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
      const backupPath = `${FileSystem.cacheDirectory}Sujata_Backup_${dateStr}.db`;

      await FileSystem.copyAsync({
        from: dbPath,
        to: backupPath
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Export Sujata Database',
          UTI: 'public.database'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Export Error:', error);
      Alert.alert('Error', 'Failed to export database.');
    }
  };

  const handleImportDatabase = async () => {
    Alert.alert(
      'Restore Database',
      'This will OVERWRITE all current data with the backup file. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*', // Allow all for now, filter in try/catch or logic
                copyToCacheDirectory: true
              });

              if (result.canceled) return;

              const pickedFile = result.assets[0];

              // Validate file extension loosely
              if (!pickedFile.name.endsWith('.db') && !pickedFile.name.endsWith('.sqlite')) {
                const proceedAnyway = await new Promise((resolve) => {
                  Alert.alert(
                    'Unknown File Type',
                    'The selected file doesn\'t look like a database. Attempt to restore anyway?',
                    [
                      { text: 'Stop', onPress: () => resolve(false) },
                      { text: 'Attempt', onPress: () => resolve(true) }
                    ]
                  );
                });
                if (!proceedAnyway) return;
              }

              const dbPath = `${FileSystem.documentDirectory}SQLite/Sujata.db`;

              // Ensure SQLite directory exists
              const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}SQLite`);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}SQLite`, { intermediates: true });
              }

              await FileSystem.copyAsync({
                from: pickedFile.uri,
                to: dbPath
              });

              Alert.alert(
                'Restore Successful',
                'Database has been restored. You MUST restart the application now to see the updated data.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Import Error:', error);
              Alert.alert('Error', 'Failed to restore database. Make sure the file is a valid SQLite backup.');
            }
          }
        }
      ]
    );
  };

  const clearAllData = () => {
    Alert.alert('WARNING', 'This will permanently delete ALL data (Equipment, Schedules, Logs, Spares, etc). Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'CLEAR ALL DATA', style: 'destructive', onPress: () => {
          const db = getDB();
          try {
            db.withTransactionSync(() => {
              db.runSync('DELETE FROM Maintenance_Log_Items');
              db.runSync('DELETE FROM Maintenance_Log');
              db.runSync('DELETE FROM Checklist_Items');
              db.runSync('DELETE FROM Maintenance_Schedule');
              db.runSync('DELETE FROM Defects');
              db.runSync('DELETE FROM Spare_Usage');
              db.runSync('DELETE FROM Equipment_Spares');
              db.runSync('DELETE FROM Spare_Parts');
              db.runSync('DELETE FROM Equipment');
            });
            Alert.alert('Cleared', 'Database has been wiped.');
          } catch (e) { Alert.alert('Error', 'Failed to clear DB'); }
        }
      }
    ]);
  };

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>SUJATA Preferences</Text>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

            {isAdmin && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Security</Text>
                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <TouchableOpacity style={styles.syncRow} onPress={() => setShowAccountModal(true)}>
                    <View style={[styles.syncIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.syncContent}>
                      <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Admin Credentials</Text>
                      <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Update username and password</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isAdmin && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Staff Management</Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Manage application users</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAddStaffModal(true)} style={styles.addBtn}>
                    <Ionicons name="person-add-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  {staffList.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No staff members added yet</Text>
                  ) : (
                    staffList.map((s, index) => (
                      <View key={s.id} style={[styles.staffRow, index === staffList.length - 1 && { borderBottomWidth: 0 }, { borderBottomColor: theme.colors.border }]}>
                        <View>
                          <Text style={[styles.staffName, { color: theme.colors.text }]}>{s.username}</Text>
                          <Text style={[styles.staffRole, { color: theme.colors.textSecondary }]}>{s.role}</Text>
                        </View>
                        <TouchableOpacity onPress={() => deleteStaff(s.id)}>
                          <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reports & Exports</Text>
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {/* Equipment Report */}
                <View style={styles.reportRow}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Equipment Inventory</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Full asset list with status</Text>
                  </View>
                  <View style={styles.exportButtons}>
                    <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => handleExport('equipment', 'csv')}>
                      <Text style={styles.exportBtnText}>EXCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleExport('equipment', 'pdf')}>
                      <Text style={styles.exportBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Maintenance Report */}
                <View style={styles.reportRow}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Maintenance History</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>All routine maintenance logs</Text>
                  </View>
                  <View style={styles.exportButtons}>
                    <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => handleExport('maintenance', 'csv')}>
                      <Text style={styles.exportBtnText}>EXCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleExport('maintenance', 'pdf')}>
                      <Text style={styles.exportBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Spares Report */}
                <View style={styles.reportRow}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Spare Parts Inventory</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Current stock levels and pricing</Text>
                  </View>
                  <View style={styles.exportButtons}>
                    <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => handleExport('spares', 'csv')}>
                      <Text style={styles.exportBtnText}>EXCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleExport('spares', 'pdf')}>
                      <Text style={styles.exportBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offline Data Sharing</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Send or receive data without internet</Text>

              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <TouchableOpacity style={styles.syncRow} onPress={handleExportDatabase}>
                  <View style={styles.syncIconContainer}>
                    <Ionicons name="bluetooth-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.syncContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Share My Data</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Export backup to another device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { marginVertical: 12 }]} />

                <TouchableOpacity style={styles.syncRow} onPress={handleImportDatabase}>
                  <View style={[styles.syncIconContainer, { backgroundColor: theme.colors.success + '15' }]}>
                    <Ionicons name="download-outline" size={24} color={theme.colors.success} />
                  </View>
                  <View style={styles.syncContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Receive Data</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Restore from a backup file</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data Management</Text>

              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.toggleRow}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Auto-Sync</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Background data synchronization</Text>
                  </View>
                  <Switch
                    value={autoSync}
                    onValueChange={setAutoSync}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                    thumbColor={autoSync ? theme.colors.primary : '#FFFFFF'}
                  />
                </View>

                <View style={styles.divider} />

                {isAdmin && (
                  <>
                    <TouchableOpacity style={styles.actionRow} onPress={clearAllData}>
                      <Text style={[styles.actionRowText, { color: theme.colors.error }]}>Clear All App Data</Text>
                      <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={[styles.version, { color: theme.colors.textSecondary }]}>App Version 1.0.0</Text>
            </View>

          </ScrollView>
        </View>

        <Modal visible={showAddStaffModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Staff Member</Text>

                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Username"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newStaffUsername}
                    onChangeText={setNewStaffUsername}
                    autoCapitalize="none"
                  />

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text, marginTop: 12 }]}
                    placeholder="Password"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newStaffPassword}
                    onChangeText={setNewStaffPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: theme.colors.background }]}
                      onPress={() => setShowAddStaffModal(false)}
                    >
                      <Text style={{ color: theme.colors.text }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={addStaff}
                    >
                      <Text style={{ color: '#FFF' }}>Add Staff</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Change Admin Account Modal */}
        <Modal visible={showAccountModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Update Admin Account</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, marginBottom: 16 }]}>
                  Change your login credentials. You will be logged out after updating.
                </Text>

                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="New Username"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={adminUsername}
                    onChangeText={setAdminUsername}
                    autoCapitalize="none"
                  />

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text, marginTop: 12 }]}
                    placeholder="New Password"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={adminPassword}
                    onChangeText={setAdminPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: theme.colors.background }]}
                      onPress={() => setShowAccountModal(false)}
                    >
                      <Text style={{ color: theme.colors.text }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={updateAdminAccount}
                    >
                      <Text style={{ color: '#FFF' }}>Update Account</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  scroll: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 14, marginBottom: 8 },
  addBtn: { padding: 8 },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 6
  },
  staffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  staffName: { fontSize: 16, fontWeight: '600' },
  staffRole: { fontSize: 13, marginTop: 2 },
  emptyText: { textAlign: 'center', fontStyle: 'italic', paddingVertical: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  rowSubtitle: { fontSize: 13 },
  divider: { height: 1, marginVertical: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  actionRowText: { fontSize: 15, fontWeight: '500' },
  footer: { alignItems: 'center', marginTop: 20 },
  version: { fontSize: 13 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  exportButtons: { flexDirection: 'row', gap: 8 },
  exportBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exportBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  syncIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  syncContent: { flex: 1 },
});
