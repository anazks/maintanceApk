import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getDB } from '../../database';
import { useTheme } from '../../context/ThemeContext';

const SCHEDULES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];

interface Equipment {
  id: number;
  equipment_id: string;
  name: string;
}

interface ChecklistItem {
  id: number;
  schedule_id: number;
  task_description: string;
  schedule_type?: string;
}

export default function Settings() {
  const router = useRouter();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'Checklists' | 'Categories' | 'Preferences'>('Checklists');
  // Category State
  const [categories, setCategories] = useState<{id: number, name: string}[]>([]);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Checklist State
  const [selectedSchedule, setSelectedSchedule] = useState('Daily');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [editTaskData, setEditTaskData] = useState<{id: number, text: string} | null>(null);
  const [unitSystem, setUnitSystem] = useState<'Metric' | 'Imperial'>('Metric');
  const [language, setLanguage] = useState('English');
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.tab === 'Categories') {
      setActiveTab('Categories');
      if (params.addCat === 'true') {
        setShowAddCatModal(true);
      }
    }
  }, [params.tab, params.addCat]);


  useEffect(() => {
    loadEquipment();
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedEquipment) {
      loadAllChecklists(selectedEquipment);
    }
  }, [selectedEquipment]);

  const loadEquipment = () => {
    const db = getDB();
    try {
      const equip = db.getAllSync<Equipment>('SELECT id, equipment_id, name FROM Equipment');
      setEquipmentList(equip);
      if (equip.length > 0) setSelectedEquipment(equip[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllChecklists = (equipId: number) => {
    const db = getDB();
    try {
      const dbItems = db.getAllSync<ChecklistItem>(`
        SELECT ci.*, ms.schedule_type 
        FROM Checklist_Items ci
        JOIN Maintenance_Schedule ms ON ci.schedule_id = ms.id
        WHERE ms.equipment_id = ?
        ORDER BY ms.schedule_type
      `, [equipId]);
      setChecklistItems(dbItems);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCategories = () => {
    const db = getDB();
    try {
      const dbCats = db.getAllSync<{id: number, name: string}>('SELECT * FROM Spare_Categories ORDER BY name');
      setCategories(dbCats);
    } catch (e) { console.error(e); }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const db = getDB();
    try {
      db.runSync('INSERT INTO Spare_Categories (name) VALUES (?)', [newCategoryName.trim()]);
      setNewCategoryName('');
      setShowAddCatModal(false);
      loadCategories();
    } catch (e) { Alert.alert('Error', 'Category already exists or failed to add.'); }
  };

  const deleteCategory = (id: number) => {
    const db = getDB();
    try {
      db.runSync('DELETE FROM Spare_Categories WHERE id = ?', [id]);
      loadCategories();
    } catch (e) { Alert.alert('Error', 'Failed to delete category.'); }
  };

  const addChecklistItem = () => {
    if (!newTask.trim() || !selectedEquipment) return;
    const db = getDB();
    try {
      let scheduleRec = db.getFirstSync<{id: number}>(
        'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
        [selectedEquipment, selectedSchedule]
      );

      // Create schedule wrapper exactly on first task addition
      if (!scheduleRec) {
        db.runSync(
          'INSERT INTO Maintenance_Schedule (equipment_id, schedule_type) VALUES (?, ?)',
          [selectedEquipment, selectedSchedule]
        );
        scheduleRec = db.getFirstSync<{id: number}>(
          'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
          [selectedEquipment, selectedSchedule]
        );
      }

      if (scheduleRec) {
        db.runSync(
          'INSERT INTO Checklist_Items (schedule_id, task_description) VALUES (?, ?)',
          [scheduleRec.id, newTask]
        );
        setNewTask('');
        setShowAddModal(false);
        loadAllChecklists(selectedEquipment);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const updateChecklistItem = () => {
    if (!editTaskData || !editTaskData.text.trim()) return;
    const db = getDB();
    try {
      db.runSync('UPDATE Checklist_Items SET task_description = ? WHERE id = ?', [editTaskData.text, editTaskData.id]);
      setShowEditModal(false);
      if (selectedEquipment) loadAllChecklists(selectedEquipment);
    } catch(e) { Alert.alert('Error', 'Failed to update item'); }
  };

  const deleteChecklistItem = (id: number) => {
    const db = getDB();
    try {
      db.runSync('DELETE FROM Checklist_Items WHERE id = ?', [id]);
      if (selectedEquipment) loadAllChecklists(selectedEquipment);
    } catch (e) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>SUJATHA Settings</Text>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Checklists' && styles.tabActive]}
            onPress={() => setActiveTab('Checklists')}
          >
            <Text style={[styles.tabText, activeTab === 'Checklists' && styles.tabTextActive]}>
              Routines
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Categories' && styles.tabActive]}
            onPress={() => setActiveTab('Categories')}
          >
            <Text style={[styles.tabText, activeTab === 'Categories' && styles.tabTextActive]}>
              Categories
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Preferences' && styles.tabActive]}
            onPress={() => setActiveTab('Preferences')}
          >
            <Text style={[styles.tabText, activeTab === 'Preferences' && styles.tabTextActive]}>
              Preferences
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Checklists' && styles.tabActive]} // Re-using style for simplicity
            onPress={() => router.push('/vessels')}
          >
            <Text style={[styles.tabText, { color: '#2563EB' }]}>
              Vessels
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* Categories Tab */}
          {activeTab === 'Categories' && (
            <View style={styles.section}>
              <View style={styles.checklistHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Spare Categories</Text>
                  <Text style={styles.sectionSubtitle}>Manage part categories</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddCatModal(true)} style={styles.dropdownBtn}>
                  <Ionicons name="add" size={20} color="#2563EB" />
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                {categories.length === 0 ? (
                  <Text style={styles.emptyText}>No categories defined</Text>
                ) : (
                  categories.map((cat, index) => (
                    <View key={cat.id} style={[styles.taskItem, index === categories.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={styles.taskDesc}>{cat.name}</Text>
                      <TouchableOpacity onPress={() => deleteCategory(cat.id)}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* Scheduling Configuration - Only visible in Checklists Tab */}
          {activeTab === 'Checklists' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dynamic Routines</Text>
              <Text style={styles.sectionSubtitle}>Configure specific routines and tasks per equipment</Text>

            <View style={styles.card}>
              
              {/* Equipment Selector dropdown replacement */}
              <Text style={styles.label}>1. Select Equipment</Text>
              <TouchableOpacity 
                style={styles.dropdownBtn}
                onPress={() => setShowEquipModal(true)}
              >
                <Text style={styles.dropdownBtnText}>
                  {selectedEquipment 
                    ? `Routine Checklist for ${equipmentList.find(e => e.id === selectedEquipment)?.name || 'Unknown'}`
                    : 'Select Equipment...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
              {equipmentList.length === 0 && (
                <Text style={styles.emptyText}>No equipment found. Add some first.</Text>
              )}

              {/* All Checklist Items Grouped by Frequency */}
              {SCHEDULES.map(schedule => {
                const items = checklistItems.filter(i => i.schedule_type === schedule);
                return (
                  <View key={schedule} style={styles.routineSlot}>
                    <View style={styles.checklistHeader}>
                      <View style={styles.slotTitleRow}>
                        <Ionicons 
                          name={items.length > 0 ? "checkbox" : "square-outline"} 
                          size={18} 
                          color={items.length > 0 ? "#2563EB" : "#9CA3AF"} 
                        />
                        <Text style={styles.listTitle}>{schedule} Routine</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          setSelectedSchedule(schedule);
                          setShowAddModal(true);
                        }}
                        style={styles.addInlineBtn}
                      >
                        <Ionicons name="add-circle" size={24} color="#2563EB" />
                      </TouchableOpacity>
                    </View>

                    {items.length === 0 ? (
                      <View style={styles.emptySlotContainer}>
                        <Text style={styles.emptySlotText}>No tasks for {schedule.toLowerCase()} routine</Text>
                      </View>
                    ) : (
                      items.map((item, index) => (
                        <View key={item.id} style={styles.taskItem}>
                          <View style={styles.taskNum}><Text style={styles.taskNumText}>{index + 1}</Text></View>
                          <Text style={styles.taskDesc}>{item.task_description}</Text>
                          <View style={styles.taskActions}>
                            <TouchableOpacity style={{ marginRight: 12 }} onPress={() => {
                              setEditTaskData({ id: item.id, text: item.task_description });
                              setShowEditModal(true);
                            }}>
                              <Ionicons name="pencil-outline" size={18} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteChecklistItem(item.id)}>
                              <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                );
              })}

              {checklistItems.length === 0 && selectedEquipment && (
                <View style={styles.initialEmptyState}>
                  <Ionicons name="construct-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Start by configuring your first routine above.</Text>
                </View>
              )}
            </View>
          </View>
          )}


          {/* Preferences Tab */}
          {activeTab === 'Preferences' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { fontSize: 15, fontWeight: '700', color: theme.colors.text }]}>App Preferences</Text>
              <Text style={[styles.sectionSubtitle, { fontSize: 11, marginTop: 0, color: theme.colors.textSecondary }]}>Customize your experience</Text>

              {/* Theme Selector - Compact Version */}
              <View style={[styles.compactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginTop: 12 }]}>
                <View style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 10, marginBottom: 10 }]}>
                   <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Display Theme</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{isDarkMode ? 'Dark' : 'Light'} mode active</Text>
                   </View>
                   <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
                    thumbColor={isDarkMode ? '#C7D2FE' : '#F3F4F6'}
                  />
                </View>

                {/* Compact Theme Selection */}
                <View style={[styles.themeSelectorCompact, { backgroundColor: theme.colors.background }]}>
                  <TouchableOpacity
                    style={[styles.themeOptionSmall, !isDarkMode && styles.themeOptionSmallActive]}
                    onPress={() => !isDarkMode ? null : toggleTheme()}
                  >
                    <Ionicons name="sunny" size={16} color={!isDarkMode ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.themeOptionLabelSmall, { color: !isDarkMode ? theme.colors.primary : theme.colors.textSecondary }]}>Light</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.themeOptionSmall, isDarkMode && styles.themeOptionSmallActive]}
                    onPress={() => isDarkMode ? null : toggleTheme()}
                  >
                    <Ionicons name="moon" size={16} color={isDarkMode ? '#818CF8' : theme.colors.textSecondary} />
                    <Text style={[styles.themeOptionLabelSmall, { color: isDarkMode ? '#818CF8' : theme.colors.textSecondary }]}>Dark</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Other Preferences */}
              <View style={[styles.compactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginTop: 12 }]}>
                <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 10 }]}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Unit System</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{unitSystem}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 10 }]}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Language</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{language}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionRow, { paddingVertical: 10 }]}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Data Backup</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Export database to device</Text>
                  </View>
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.compactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginTop: 12 }]}>
                <TouchableOpacity 
                   style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 10 }]}
                   onPress={() => router.push('/sync')}
                >
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Synchronize Data</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Search nearby via Wi-Fi/Bluetooth</Text>
                  </View>
                  <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionRow, { paddingVertical: 10 }]}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Notifications</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Manage maintenance alerts</Text>
                  </View>
                  <Ionicons name="notifications-outline" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.version}>App Version 1.0.0</Text>
          </View>

        </ScrollView>
      </View>

      {/* Add Task Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Task</Text>
            <Text style={styles.modalSub}>Select frequency and enter the description</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { marginBottom: 16 }]}>
              {SCHEDULES.map(schedule => (
                <TouchableOpacity
                  key={schedule}
                  style={[styles.chip, selectedSchedule === schedule && styles.chipActive]}
                  onPress={() => setSelectedSchedule(schedule)}
                >
                  <Text style={[styles.chipText, selectedSchedule === schedule && styles.chipTextActive]}>
                    {schedule}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Check Oil Levels"
              value={newTask}
              onChangeText={setNewTask}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowAddModal(false); setNewTask(''); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={addChecklistItem}>
                <Text style={styles.modalBtnSubmitText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Task Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Task</Text>
            <Text style={styles.modalSub}>Update the checklist item description</Text>
            <TextInput
              style={styles.modalInput}
              value={editTaskData?.text || ''}
              onChangeText={text => setEditTaskData(prev => prev ? { ...prev, text } : null)}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowEditModal(false); setEditTaskData(null); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={updateChecklistItem}>
                <Text style={styles.modalBtnSubmitText}>Update Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={showAddCatModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Category</Text>
            <Text style={styles.modalSub}>Enter the name for the new spare part category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Fluids, Fasteners"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowAddCatModal(false); setNewCategoryName(''); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={addCategory}>
                <Text style={styles.modalBtnSubmitText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Equipment Select Modal */}
      <Modal visible={showEquipModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%', padding: 0 }]}>
              <View style={styles.equipModalHeader}>
                <Text style={styles.modalTitle}>Select Equipment</Text>
                <TouchableOpacity onPress={() => setShowEquipModal(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ width: '100%' }}>
                {equipmentList.map(eq => (
                  <TouchableOpacity
                    key={eq.id}
                    style={[
                      styles.equipModalRow,
                      selectedEquipment === eq.id && styles.equipModalRowActive
                    ]}
                    onPress={() => {
                      setSelectedEquipment(eq.id);
                      setShowEquipModal(false);
                    }}
                  >
                    <View>
                      <Text style={[styles.equipModalName, selectedEquipment === eq.id && {color: '#2563EB'}]}>{eq.name}</Text>
                      <Text style={styles.equipModalId}>{eq.equipment_id}</Text>
                    </View>
                    {selectedEquipment === eq.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    paddingHorizontal: 16, 
    paddingTop: 32,
    paddingBottom: 8, 
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 12, 
    paddingVertical: 8,
    borderBottomWidth: 1, 
    borderBottomColor: '#E5E7EB' 
  },
  tab: { flex: 1, paddingVertical: 6, alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 6, marginHorizontal: 3 },
  tabActive: { backgroundColor: '#2563EB', elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  scroll: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 6
  },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 12 },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, marginBottom: 16 },
  dropdownBtnText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  chips: { gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#4B5563' },
  chipTextActive: { color: '#FFFFFF' },
  emptyText: { color: '#9CA3AF', fontStyle: 'italic', marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  taskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  taskNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  taskNumText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  taskDesc: { flex: 1, fontSize: 14, color: '#374151', paddingRight: 8 },
  taskActions: { flexDirection: 'row', alignItems: 'center' },
  routineSlot: { 
    marginBottom: 20, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 16, 
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  slotTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInlineBtn: { padding: 4 },
  emptySlotContainer: { padding: 12, alignItems: 'center', justifyContent: 'center' },
  emptySlotText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  initialEmptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 12, gap: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowSubtitle: { fontSize: 11, color: '#6B7280' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  actionRowText: { fontSize: 15, fontWeight: '500', color: '#111827' },
  footer: { alignItems: 'center', marginTop: 20 },
  version: { fontSize: 13, color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  modalInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  modalBtnSubmit: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center' },
  modalBtnSubmitText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  equipModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', width: '100%' },
  equipModalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  equipModalRowActive: { backgroundColor: '#EFF6FF' },
  equipModalName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  equipModalId: { fontSize: 13, color: '#6B7280' },
  themeCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 6,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  themeCardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  themeCardSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  themeSelector: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 6,
    gap: 8,
    marginBottom: 16,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  themeOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  quickToggleRow: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 4,
  },
  compactCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  themeSelectorCompact: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 6,
  },
  themeOptionSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  themeOptionSmallActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  themeOptionLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
});
