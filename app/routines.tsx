import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getDB } from '../database';

interface RoutineTask {
  id: number;
  equipment_name: string;
  equipment_id: string;
  schedule_type: string;
  scheduled_date: string;
  last_completed_date?: string;
  status: string;
  description: string;
  hasChecklist: boolean;
}

export default function Maintenance() {
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [tasks, setTasks] = useState<RoutineTask[]>([]);

  // Date Filtering State
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'from' | 'to'>('from');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentCalendarDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentCalendarDate(newDate);
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    if (calendarTarget === 'from') {
      setFromDate(dateStr);
    } else {
      setToDate(dateStr);
    }
    setShowCalendar(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadMaintenanceSchedules();
    }, [])
  );

  const loadMaintenanceSchedules = () => {
    const db = getDB();
    try {
      const allSchedules = db.getAllSync<any>(`
        SELECT 
          ms.id, 
          ms.schedule_type, 
          ms.next_maintenance,
          e.name as equipment_name, 
          e.equipment_id as equipment_ref,
          (SELECT COUNT(*) FROM Checklist_Items ci WHERE ci.schedule_id = ms.id) as checklist_count,
          (SELECT MAX(maintenance_date) FROM Maintenance_Log ml WHERE ml.equipment_id = e.id AND ml.schedule_type = ms.schedule_type AND ml.status = 'Completed') as last_completed
        FROM Maintenance_Schedule ms
        JOIN Equipment e ON ms.equipment_id = e.id
      `);

      const formattedTasks = allSchedules.map(task => {
        const checklistCount = task.checklist_count || 0;

        let currentStatus = 'Pending';
        let formattedDate = 'Unscheduled';

        if (task.next_maintenance) {
          formattedDate = task.next_maintenance.split(' ')[0];
          const curDateStr = new Date().toISOString().split('T')[0];

          if (formattedDate > curDateStr) {
            currentStatus = 'Completed'; // Future task, locked out
          } else if (formattedDate < curDateStr) {
            currentStatus = 'Overdue';
          } else {
            currentStatus = 'Pending'; // Due exactly today, so it remains unlocked
          }
        }

        // If no checklist is configured, mark as Incomplete Config
        if (checklistCount === 0) {
          currentStatus = 'Incomplete';
        }

        return {
          id: task.id,
          equipment_name: task.equipment_name,
          equipment_id: task.equipment_ref,
          schedule_type: task.schedule_type,
          scheduled_date: formattedDate,
          last_completed_date: task.last_completed ? task.last_completed.split(' ')[0] : undefined,
          status: currentStatus,
          description: checklistCount > 0 ? `${checklistCount} checklist items to complete` : 'No checklist items configured.',
          hasChecklist: checklistCount > 0,
        };
      });

      setTasks(formattedTasks);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Basic status filter
    if (selectedFilter !== 'All') {
      if (selectedFilter === 'Pending') {
        if (!(task.status === 'Pending' && task.hasChecklist)) return false;
      } else if (task.status !== selectedFilter) {
        return false;
      }
    }

    // Date range filter
    if (fromDate && task.scheduled_date < fromDate) return false;
    if (toDate && task.scheduled_date > toDate) return false;

    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return '#EF4444';
      case 'High': return '#F97316';
      case 'Medium': return '#EAB308';
      case 'Low': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getPriorityBgColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return '#FEF2F2';
      case 'High': return '#FFF7ED';
      case 'Medium': return '#FEFCE8';
      case 'Low': return '#EFF6FF';
      default: return '#F3F4F6';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#10B981';
      case 'Overdue': return '#EF4444';
      case 'Pending': return '#F59E0B';
      case 'Incomplete': return '#9CA3AF';
      default: return '#6B7280';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#D1FAE5';
      case 'Overdue': return '#FEE2E2';
      case 'Pending': return '#FEF3C7';
      case 'Incomplete': return '#F3F4F6';
      default: return '#F3F4F6';
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
        {/* Date Filter Bar */}
        <View style={[styles.filterBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.filterInputs}>
            <TouchableOpacity 
              style={[styles.dateInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => { setCalendarTarget('from'); setShowCalendar(true); }}
            >
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.dateInputText, { color: fromDate ? theme.colors.text : theme.colors.textSecondary }]}>
                {fromDate || 'From Date'}
              </Text>
            </TouchableOpacity>
            
            <Ionicons name="arrow-forward" size={16} color={theme.colors.textSecondary} />
            
            <TouchableOpacity 
              style={[styles.dateInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => { setCalendarTarget('to'); setShowCalendar(true); }}
            >
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.dateInputText, { color: toDate ? theme.colors.text : theme.colors.textSecondary }]}>
                {toDate || 'To Date'}
              </Text>
            </TouchableOpacity>
          </View>

          {(fromDate || toDate) && (
            <TouchableOpacity 
              style={styles.clearBtn} 
              onPress={() => { setFromDate(null); setToDate(null); }}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATA Service</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Schedules & Work Orders</Text>
          </View>
          <TouchableOpacity
            onPress={loadMaintenanceSchedules}
            style={[styles.addButtonSmall, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', marginRight: 8 }]}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButtonSmall, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}
            onPress={() => router.push('/add-equipment')}
          >
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {['All', 'Pending', 'Overdue', 'Completed'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  selectedFilter === filter && [styles.filterChipActive, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[styles.filterChipText, { color: theme.colors.textSecondary }, selectedFilter === filter && styles.filterChipTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filteredTasks}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.border} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>All caught up!</Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No routine tasks found for this filter.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, item.status === 'Completed' && [styles.cardDisabled, { backgroundColor: theme.dark ? '#1F2937' : '#F9FAFB' }]]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.equipmentName, { color: theme.colors.text }]}>{item.equipment_name} ({item.schedule_type})</Text>
                  <Text style={[styles.equipmentId, { color: theme.colors.textSecondary }]}>{item.equipment_id}</Text>
                  {item.status === 'Completed' && (
                    <Text style={styles.unlocksText}>Next checklist opens {item.scheduled_date}</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: theme.dark ? (item.status === 'Completed' ? '#064e3b' : (item.status === 'Overdue' ? '#451a03' : '#3f2e03')) : getStatusBgColor(item.status), flexDirection: 'row', alignItems: 'center' }]}>
                  {item.status === 'Completed' && <Ionicons name="lock-closed" size={12} color={getStatusColor(item.status)} style={{ marginRight: 4 }} />}
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>

              <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>

              <View style={styles.cardFooterActions}>
                <TouchableOpacity
                  style={[styles.historyBtn, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}
                  onPress={() => router.push({
                    pathname: '/routine-history',
                    params: { equipmentId: item.equipment_id, equipmentName: item.equipment_name }
                  })}
                >
                  <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.historyBtnText, { color: theme.colors.primary }]}>History</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />

                {item.hasChecklist && (
                  <TouchableOpacity
                    style={[styles.smallExecuteBtn, { backgroundColor: theme.colors.primary }, item.status === 'Completed' && [styles.smallExecuteBtnDisabled, { backgroundColor: theme.colors.border }]]}
                    disabled={item.status === 'Completed'}
                    onPress={() => {
                      router.push({
                        pathname: '/routine-execute',
                        params: {
                          id: item.id.toString(),
                          equipment_name: item.equipment_name,
                          equipment_id: item.equipment_id,
                          schedule_type: item.schedule_type
                        }
                      });
                    }}
                  >
                    <Text style={[styles.smallExecuteBtnText, item.status === 'Completed' && [styles.smallExecuteBtnTextDisabled, { color: theme.colors.textSecondary }]]}>
                      {item.status === 'Completed' ? 'Locked' : 'Start Task'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.cardFooter, { borderTopColor: theme.colors.border }]}>
                <View style={styles.footerItem}>
                  <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>Due: {item.scheduled_date}</Text>
                </View>

                {item.last_completed_date && (
                  <View style={styles.footerItem}>
                    <Ionicons name="checkmark-done-outline" size={16} color={theme.colors.success} />
                    <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>Done: {item.last_completed_date}</Text>
                  </View>
                )}

                <View style={styles.footerItem}>
                  <Ionicons name="build-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>{item.schedule_type}</Text>
                </View>
              </View>
            </View>
          )}
        />

        <Modal
          visible={showCalendar}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCalendar(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCalendar(false)}
          >
            <View
              style={[styles.calendarContent, { backgroundColor: theme.colors.surface }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={[styles.calendarHeader, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calendarNavBtn}>
                  <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.calendarMonthText, { color: theme.colors.text }]}>
                  {MONTH_NAMES[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.calendarNavBtn}>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarDaysHeader}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <Text key={i} style={[styles.calendarDayLabel, { color: theme.colors.textSecondary }]}>{day}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {Array.from({ length: getFirstDayOfMonth(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear()) }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.calendarDayCell} />
                ))}
                {Array.from({ length: getDaysInMonth(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear()) }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = (calendarTarget === 'from' && fromDate === new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day).toISOString().split('T')[0]) ||
                    (calendarTarget === 'to' && toDate === new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day).toISOString().split('T')[0]);

                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.calendarDayCell, isSelected && { backgroundColor: theme.colors.primary, borderRadius: 20 }]}
                      onPress={() => handleDateSelect(day)}
                    >
                      <Text style={[styles.calendarDayText, { color: isSelected ? '#FFFFFF' : theme.colors.text }]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.calendarCloseBtn, { backgroundColor: theme.colors.background }]}
                onPress={() => setShowCalendar(false)}
              >
                <Text style={[styles.calendarCloseBtnText, { color: theme.colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#2563EB', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  addButtonSmall: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  filterContainer: { backgroundColor: '#FFFFFF', paddingBottom: 12, paddingTop: 12 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterChipText: { fontSize: 14, fontWeight: '500', color: '#4B5563' },
  filterChipTextActive: { color: '#FFFFFF' },
  listContainer: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6', padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  equipmentName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  equipmentId: { fontSize: 13, color: '#6B7280', fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  description: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardFooterActions: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  historyBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  smallExecuteBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  smallExecuteBtnDisabled: { backgroundColor: '#F3F4F6' },
  smallExecuteBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  smallExecuteBtnTextDisabled: { color: '#9CA3AF' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 13, color: '#6B7280' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  cardDisabled: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.95 },
  unlocksText: { fontSize: 12, color: '#D97706', marginTop: 4, fontWeight: '500' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  filterInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateInputText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  calendarContent: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    marginBottom: 15,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarCloseBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
