import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
}

export default function Maintenance() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [tasks, setTasks] = useState<RoutineTask[]>([]);

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
          (SELECT MAX(maintenance_date) FROM Maintenance_Log ml WHERE ml.equipment_id = e.id AND ml.schedule_type = ms.schedule_type AND ml.status = 'Completed') as last_completed
        FROM Maintenance_Schedule ms
        JOIN Equipment e ON ms.equipment_id = e.id
      `);

      const formattedTasks = allSchedules.map(task => {
        // Find if they have any assigned checklists
        const checklistsCount = db.getFirstSync<{count: number}>(
          'SELECT COUNT(*) as count FROM Checklist_Items WHERE schedule_id = ?', 
          [task.id]
        );

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

        return {
          id: task.id,
          equipment_name: task.equipment_name,
          equipment_id: task.equipment_ref,
          schedule_type: task.schedule_type,
          scheduled_date: formattedDate,
          last_completed_date: task.last_completed ? task.last_completed.split(' ')[0] : undefined,
          status: currentStatus,
          description: checklistsCount?.count ? `${checklistsCount.count} checklist items to complete` : 'No checklist items configured.',
        };
      });

      setTasks(formattedTasks);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Pending') return task.status === 'Pending' || task.status === 'Scheduled';
    return task.status === selectedFilter;
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
      default: return '#6B7280';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#D1FAE5';
      case 'Overdue': return '#FEE2E2';
      case 'Pending': return '#FEF3C7';
      default: return '#F3F4F6';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={{flex: 1, marginLeft: 16}}>
            <Text style={styles.brandTitle}>SUJATHA Service</Text>
            <Text style={styles.headerSubtitle}>Schedules & Work Orders</Text>
          </View>
          <TouchableOpacity style={styles.addButtonSmall}>
            <Ionicons name="add" size={24} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {['All', 'Pending', 'Overdue', 'Completed'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[styles.filterChipText, selectedFilter === filter && styles.filterChipTextActive]}>
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
              <Ionicons name="checkmark-circle-outline" size={64} color="#E5E7EB" />
              <Text style={styles.emptyStateTitle}>All caught up!</Text>
              <Text style={styles.emptyStateText}>No routine tasks found for this filter.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.card, item.status === 'Completed' && styles.cardDisabled]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.equipmentName}>{item.equipment_name} ({item.schedule_type})</Text>
                  <Text style={styles.equipmentId}>{item.equipment_id}</Text>
                  {item.status === 'Completed' && (
                    <Text style={styles.unlocksText}>Next checklist opens {item.scheduled_date}</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status), flexDirection: 'row', alignItems: 'center' }]}>
                  {item.status === 'Completed' && <Ionicons name="lock-closed" size={12} color={getStatusColor(item.status)} style={{marginRight: 4}} />}
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

              <View style={styles.cardFooterActions}>
                <TouchableOpacity 
                  style={styles.historyBtn}
                  onPress={() => router.push({
                    pathname: '/routine-history',
                    params: { equipmentId: item.equipment_id, equipmentName: item.equipment_name }
                  })}
                >
                  <Ionicons name="time-outline" size={18} color="#2563EB" />
                  <Text style={styles.historyBtnText}>History</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity 
                  style={[styles.smallExecuteBtn, item.status === 'Completed' && styles.smallExecuteBtnDisabled]}
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
                  <Text style={[styles.smallExecuteBtnText, item.status === 'Completed' && styles.smallExecuteBtnTextDisabled]}>
                    {item.status === 'Completed' ? 'Locked' : 'Start Task'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.footerItem}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.footerText}>Due: {item.scheduled_date}</Text>
                </View>

                {item.last_completed_date && (
                  <View style={styles.footerItem}>
                    <Ionicons name="checkmark-done-outline" size={16} color="#10B981" />
                    <Text style={styles.footerText}>Done: {item.last_completed_date}</Text>
                  </View>
                )}

                <View style={styles.footerItem}>
                  <Ionicons name="build-outline" size={16} color="#6B7280" />
                  <Text style={styles.footerText}>{item.schedule_type}</Text>
                </View>
              </View>
            </View>
          )}
        />
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
});
