import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { getDB } from '../database';
import { useTheme } from '../context/ThemeContext';

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

      const dbLogs = db.getAllSync<any>(
        'SELECT * FROM Maintenance_Log WHERE equipment_id = ? ORDER BY maintenance_date DESC',
        [internalId]
      );

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
  }, [equipmentId, equipment_id]);

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
          <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATHA History</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>{equipmentName || 'Asset History'}</Text>
        </View>
        <View style={{ width: 40 }} />
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
});
