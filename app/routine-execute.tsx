import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDB } from '../database';

interface ChecklistItem {
  id: number;
  task_description: string;
  is_completed: boolean;
}

export default function RoutineExecute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scheduleId = Number(params.id) || 0;
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [maintainer, setMaintainer] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Equipment details derived from params
  const equipmentName = (params.equipment_name as string) || 'Unknown Equipment';
  const equipmentId = (params.equipment_id as string) || 'N/A';
  const scheduleType = (params.schedule_type as string) || 'Routine';

  useEffect(() => {
    if (scheduleId) loadChecklistItems();
    requestPermissionsAsync();
  }, [scheduleId]);

  const requestPermissionsAsync = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        console.log('Push notifications not granted by user.');
    }
  };

  const loadChecklistItems = () => {
    const db = getDB();
    try {
      const dbItems = db.getAllSync<ChecklistItem>(
        'SELECT id, task_description, 0 as is_completed FROM Checklist_Items WHERE schedule_id = ?',
        [scheduleId]
      );
      setItems(dbItems.map(item => ({ ...item, is_completed: false })));
      setLoading(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load checklist items');
      setLoading(false);
    }
  };

  const toggleItem = (id: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, is_completed: !item.is_completed } : item
    ));
  };

  const saveRoutineLog = () => {
    if (!maintainer.trim()) {
      Alert.alert('Required', 'Please enter maintainer name');
      return;
    }

    const uncompleted = items.filter(i => !i.is_completed).length;
    if (uncompleted > 0) {
      Alert.alert(
        'Incomplete Tasks',
        `You have ${uncompleted} incomplete tasks. Are you sure you want to finish this routine?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', style: 'destructive', onPress: commitLog }
        ]
      );
    } else {
      commitLog();
    }
  };

  const commitLog = () => {
    const db = getDB();
    try {
      db.withTransactionSync(() => {
        // Query equip internal id
        const eqRec = db.getFirstSync<{id: number}>('SELECT id FROM Equipment WHERE equipment_id = ?', [equipmentId]);
        if (!eqRec) throw new Error('Equipment not found');

        const logResult = db.runSync(`
          INSERT INTO Maintenance_Log (equipment_id, schedule_type, maintenance_date, maintainer_name, remarks, status)
          VALUES (?, ?, datetime('now'), ?, ?, 'Completed')
        `, [eqRec.id, scheduleType, maintainer, remarks]);

        const newLogId = logResult.lastInsertRowId;
        
        // Insert checklist items completed status
        const itemStmt = db.prepareSync('INSERT INTO Maintenance_Log_Items (log_id, checklist_item_id, is_completed) VALUES (?, ?, ?)');
        items.forEach(item => {
          itemStmt.executeSync([newLogId, item.id, item.is_completed ? 1 : 0]);
        });
        itemStmt.finalizeSync();

        const nowObj = new Date();
        let secondsMod = 86400; // 1 day
        if (scheduleType === 'Weekly') { secondsMod = 604800; }
        if (scheduleType === 'Monthly') { secondsMod = 2592000; }
        if (scheduleType === 'Quarterly') { secondsMod = 7776000; }
        if (scheduleType === 'Yearly') { secondsMod = 31536000; }

        const nextDate = new Date(nowObj.getTime() + (secondsMod * 1000));
        const formattedNext = nextDate.toISOString().replace('T', ' ').split('.')[0];

        db.runSync(`
          UPDATE Maintenance_Schedule 
          SET next_maintenance = ?
          WHERE id = ?
        `, [formattedNext, scheduleId]);

        // Schedule local push notification
        schedulePushNotification(equipmentName, scheduleType, secondsMod);
      });

      Alert.alert('Success', 'Routine log saved successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save routine log');
    }
  };

  const schedulePushNotification = async (equipName: string, type: string, secondsInFuture: number) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Routine Reminder 🛠️",
          body: `The ${type} routine for ${equipName} is due soon!`,
          sound: "default"
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsInFuture
        },
      });
    } catch(e) { console.error('Failed scheduling notification', e); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const completedCount = items.filter(i => i.is_completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Execute {scheduleType}</Text>
            <Text style={styles.headerSubtitle}>{equipmentName} ({equipmentId})</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Progress</Text>
              <Text style={styles.progressText}>{completedCount} of {items.length} completed</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklist Items</Text>
            {items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="list-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No checklist defined for this equipment.</Text>
              </View>
            ) : (
              <View style={styles.taskList}>
                {items.map((item, index) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.taskItem, item.is_completed && styles.taskItemCompleted]}
                    onPress={() => toggleItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, item.is_completed && styles.checkboxActive]}>
                      {item.is_completed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskDesc, item.is_completed && styles.taskDescCompleted]}>
                        {item.task_description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion Details</Text>
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Performed By *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter mechanic/engineer name"
                value={maintainer}
                onChangeText={setMaintainer}
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Remarks / Observations</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes on condition, issues found, etc."
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={saveRoutineLog}>
            <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Commit Routine Log</Text>
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280' },
  
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#6B7280', fontSize: 16 },

  scroll: { padding: 16, paddingBottom: 40 },
  
  progressSection: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  progressText: { fontSize: 14, color: '#6B7280' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  
  taskList: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  taskItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: 'center' },
  taskItemCompleted: { backgroundColor: '#F9FAFB' },
  
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#FFFFFF' },
  checkboxActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  
  taskContent: { flex: 1 },
  taskDesc: { fontSize: 15, color: '#374151' },
  taskDescCompleted: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  
  emptyCard: { backgroundColor: '#FFFFFF', padding: 32, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { color: '#6B7280', marginTop: 12, textAlign: 'center' },
  
  inputCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827' },
  textArea: { minHeight: 100 },

  submitButton: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }
});
