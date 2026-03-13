import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDB } from '../database';

interface Defect {
  id: number;
  equipment_name: string;
  equipment_id_str: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  report_date: string;
  reported_by: string;
}

export default function ReportDefect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Closed'>('Open');

  const loadDefects = useCallback(() => {
    setLoading(true);
    const db = getDB();
    try {
      const query = `
        SELECT d.*, e.name as equipment_name, e.equipment_id as equipment_id_str
        FROM Defects d
        JOIN Equipment e ON d.equipment_id = e.id
        ORDER BY d.report_date DESC
      `;
      const rows = db.getAllSync<Defect>(query);
      setDefects(rows);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load defect reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefects();
  }, [loadDefects]);

  const updateDefectStatus = (id: number, newStatus: string) => {
    const db = getDB();
    try {
      db.runSync('UPDATE Defects SET status = ? WHERE id = ?', [newStatus, id]);
      loadDefects();
    } catch (e) {
      Alert.alert('Error', 'Failed to update defect status.');
    }
  };

  const filteredDefects = defects.filter(d => filter === 'All' || d.status === filter);

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return '#EF4444';
      case 'High': return '#F59E0B';
      case 'Medium': return '#2563EB';
      default: return '#10B981';
    }
  };

  const renderDefect = ({ item }: { item: Defect }) => (
    <View style={styles.defectCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
          <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>{item.priority}</Text>
        </View>
        <Text style={styles.dateText}>{item.report_date.split('T')[0]}</Text>
      </View>

      <Text style={styles.defectTitle}>{item.title}</Text>
      
      <View style={styles.equipSmallRow}>
        <Ionicons name="hardware-chip-outline" size={14} color="#6B7280" />
        <Text style={styles.equipNameText}>{item.equipment_name}</Text>
        <Text style={styles.equipIdText}>({item.equipment_id_str})</Text>
      </View>

      <Text style={styles.defectDesc}>{item.description}</Text>

      <View style={styles.cardFooter}>
         <View style={styles.reportedByRow}>
           <Ionicons name="person-circle-outline" size={16} color="#9CA3AF" />
           <Text style={styles.reportedByText}>{item.reported_by}</Text>
         </View>
         
         {item.status === 'Open' ? (
           <TouchableOpacity 
             style={styles.resolveBtn} 
             onPress={() => updateDefectStatus(item.id, 'Closed')}
           >
             <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
             <Text style={styles.resolveBtnText}>Resolve</Text>
           </TouchableOpacity>
         ) : (
           <View style={styles.closedBadge}>
             <Ionicons name="checkmark-circle" size={16} color="#059669" />
             <Text style={styles.closedText}>Closed</Text>
           </View>
         )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Defect Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterBar}>
        {(['Open', 'Closed', 'All'] as const).map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filteredDefects}
          keyExtractor={item => item.id.toString()}
          renderItem={renderDefect}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={64} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>No {filter === 'All' ? '' : filter.toLowerCase()} defects found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 40, paddingBottom: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  filterBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  defectCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  defectTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  equipSmallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  equipNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  equipIdText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  defectDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reportedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportedByText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resolveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
