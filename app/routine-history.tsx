import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getDB } from '../database';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LogItem {
  id: number;
  task_description: string;
  is_completed: boolean;
}

interface MaintenanceLog {
  id: number;
  equipment_id: number;
  schedule_type: string;
  maintainer_name: string;
  remarks: string;
  maintenance_date: string;
  status: string;
  items: LogItem[];
  expanded?: boolean;
}

export default function RoutineHistory() {
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();
  const { equipmentId, equipment_id, equipmentName } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  
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

  const loadHistory = useCallback(() => {
    const db = getDB();
    setLoading(true);

    try {
      // Use either camelCase or snake_case param
      const rawId = equipmentId || equipment_id;
      if (!rawId) {
        setLoading(false);
        return;
      }

      const equipIdStr = Array.isArray(rawId) ? rawId[0] : rawId;
      let internalId: number;

      // Try to find if this equipment exists by string ID first, 
      // because string IDs could be numeric (e.g. "1001")
      const eqByStringId = db.getFirstSync<{ id: number }>('SELECT id FROM Equipment WHERE equipment_id = ?', [equipIdStr]);

      if (eqByStringId) {
        internalId = eqByStringId.id;
      } else {
        // If not found by string ID, assume it's an internal ID if it's numeric
        const numericId = Number(equipIdStr);
        if (!isNaN(numericId)) {
          internalId = numericId;
        } else {
          console.error('Could not resolve equipment ID:', equipIdStr);
          setLoading(false);
          return;
        }
      }

      let query = 'SELECT * FROM Maintenance_Log WHERE equipment_id = ?';
      const params: any[] = [internalId];

      if (fromDate) {
        query += ' AND maintenance_date >= ?';
        params.push(`${fromDate} 00:00:00`);
      }
      if (toDate) {
        query += ' AND maintenance_date <= ?';
        params.push(`${toDate} 23:59:59`);
      }

      query += ' ORDER BY maintenance_date DESC';

      const dbLogs = db.getAllSync<any>(query, params);

      const logsWithItems = dbLogs.map((log: any) => {
        const items = db.getAllSync<any>(`
          SELECT mli.id, ci.task_description, mli.is_completed
          FROM Maintenance_Log_Items mli
          JOIN Checklist_Items ci ON mli.checklist_item_id = ci.id
          WHERE mli.log_id = ?
        `, [log.id]);

        return {
          ...log,
          items: items.map((i: any) => ({
            id: i.id,
            task_description: i.task_description,
            is_completed: !!i.is_completed,
          })),
          expanded: false,
        };
      });

      setLogs(logsWithItems);
      setLoading(false);
    } catch (error) {
      console.error('Error loading history:', error);
      setLoading(false);
    }
  }, [equipmentId, equipment_id, fromDate, toDate]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLogs(prevLogs => prevLogs.map(log =>
      log.id === id ? { ...log, expanded: !log.expanded } : log
    ));
  };

  const renderLogEntry = ({ item }: { item: MaintenanceLog }) => {
    const date = new Date(item.maintenance_date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <TouchableOpacity
        style={[styles.logCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, item.expanded && [styles.logCardExpanded, { borderColor: theme.colors.primary }]]}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.logHeader}>
          <View style={styles.logHeaderLeft}>
            <View style={[styles.typeBadge, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}>
              <Text style={[styles.typeText, { color: theme.colors.primary }]}>{item.schedule_type}</Text>
            </View>
            <Text style={[styles.logDate, { color: theme.colors.text }]}>{date}</Text>
          </View>
          <Ionicons
            name={item.expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.logSummary}>
          <View style={styles.maintainerRow}>
            <Ionicons name="person-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.maintainerText, { color: theme.colors.textSecondary }]}>{item.maintainer_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: theme.dark ? '#064e3b' : '#D1FAE5' }]}>
            <Text style={[styles.statusText, { color: theme.colors.success }]}>{item.status}</Text>
          </View>
        </View>

        {item.expanded && (
          <View style={styles.expandedContent}>
            <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Checklist Results:</Text>
            {item.items.map((check) => (
              <View key={check.id} style={styles.checkRow}>
                <Ionicons
                  name={check.is_completed ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={check.is_completed ? theme.colors.success : theme.colors.error}
                />
                <Text style={[styles.checkText, { color: theme.colors.text }, !check.is_completed && [styles.checkTextIncomplete, { color: theme.colors.textSecondary }]]}>
                  {check.task_description}
                </Text>
              </View>
            ))}

            {item.remarks ? (
              <>
                <Text style={[styles.detailLabel, { marginTop: 12, color: theme.colors.textSecondary }]}>Remarks:</Text>
                <View style={[styles.remarksBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.remarksText, { color: theme.colors.text }]}>{item.remarks}</Text>
                </View>
              </>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />

      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATA History</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>{equipmentName || 'Asset History'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

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

      <FlatList
        data={logs}
        keyExtractor={item => item.id.toString()}
        renderItem={renderLogEntry}
        contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={theme.colors.border} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No History Found</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No routine logs have been recorded for this asset yet.</Text>
          </View>
        }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  listContent: { padding: 20, paddingBottom: 40 },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  logCardExpanded: {
    borderColor: '#DBEAFE',
    shadowOpacity: 0.1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  logDate: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  logSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  maintainerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maintainerText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  expandedContent: {
    marginTop: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  checkText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  checkTextIncomplete: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  remarksBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  remarksText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
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
