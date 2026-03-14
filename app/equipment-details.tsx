import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDB } from '../database';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Equipment {
  id: number;
  equipment_id: string;
  name: string;
  section: string;
  location: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  installation_date: string;
  status: string;
}

interface MaintenanceSchedule {
  id: number;
  schedule_type: string;
  next_maintenance: string;
  task_count?: number;
}

interface AssignedSpare {
  id: number;
  spare_id: number;
  name: string;
  part_number: string;
  available_quantity: number;
  minimum_quantity: number;
  linked_by?: string;
}

interface UsageRecord {
  id: number;
  spare_name: string;
  part_number: string;
  quantity_used: number;
  maintainer_name: string;
  used_date: string;
}

export default function EquipmentDetails() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const { id } = useLocalSearchParams();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [spares, setSpares] = useState<AssignedSpare[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastMaintenance, setLastMaintenance] = useState<string>('N/A');
  const [nextMaintenance, setNextMaintenance] = useState<string>('N/A');

  // Spares Withdraw Modal
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedSpare, setSelectedSpare] = useState<AssignedSpare | null>(null);
  const [useQuantity, setUseQuantity] = useState('1');
  const [useMaintainer, setUseMaintainer] = useState('');

  // Spares Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableSpares, setAvailableSpares] = useState<any[]>([]);
  const [linkMaintainerName, setLinkMaintainerName] = useState('');

  // Status Update Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [tempStatus, setTempStatus] = useState('');

  // Defect Reporting Modal
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectLoading, setDefectLoading] = useState(false);
  const [defectForm, setDefectForm] = useState({ title: '', description: '', priority: 'Medium', reportedBy: '' });

  useFocusEffect(
    useCallback(() => {
      if (id) loadDetails(Number(id));
    }, [id])
  );

  const loadDetails = (equipmentId: number) => {
    try {
      const db = getDB();
      const item = db.getFirstSync<Equipment>(
        'SELECT * FROM Equipment WHERE id = ?',
        [equipmentId]
      );
      if (item) {
        setEquipment(item);
        setTempStatus(item.status);
        const scheds = db.getAllSync<MaintenanceSchedule>(`
          SELECT ms.id, ms.schedule_type, ms.next_maintenance, COUNT(ci.id) as task_count
          FROM Maintenance_Schedule ms
          LEFT JOIN Checklist_Items ci ON ms.id = ci.schedule_id
          WHERE ms.equipment_id = ?
          GROUP BY ms.id
        `, [item.id]);
        setSchedules(scheds);

        const nextDateObj = db.getFirstSync<{ next_date: string }>(
          'SELECT MIN(next_maintenance) as next_date FROM Maintenance_Schedule WHERE equipment_id = ? AND next_maintenance IS NOT NULL',
          [item.id]
        );
        setNextMaintenance(nextDateObj?.next_date ? nextDateObj.next_date.split(' ')[0] : 'N/A');

        const lastDateObj = db.getFirstSync<{ last_date: string }>(
          "SELECT MAX(maintenance_date) as last_date FROM Maintenance_Log WHERE equipment_id = ? AND status = 'Completed'",
          [item.id]
        );
        setLastMaintenance(lastDateObj?.last_date ? lastDateObj.last_date.split(' ')[0] : 'N/A');

        const assignedSpares = db.getAllSync<AssignedSpare>(`
          SELECT 
            es.id,
            es.linked_by,
            sp.id as spare_id,
            sp.name,
            sp.part_number,
            sp.available_quantity,
            sp.minimum_quantity
          FROM Equipment_Spares es
          JOIN Spare_Parts sp ON es.spare_id = sp.id
          WHERE es.equipment_id = ?
        `, [item.id]);
        setSpares(assignedSpares);

        const history = db.getAllSync<UsageRecord>(`
          SELECT 
            su.id,
            sp.name as spare_name,
            sp.part_number,
            su.quantity_used,
            su.maintainer_name,
            su.used_date
          FROM Spare_Usage su
          JOIN Spare_Parts sp ON su.spare_id = sp.id
          WHERE su.equipment_id = ?
          ORDER BY su.used_date DESC
          LIMIT 10
        `, [item.id]);
        setUsageHistory(history);

      } else {
        Alert.alert('Error', 'Equipment not found.');
        router.back();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load details.');
    } finally {
      setLoading(false);
      setStatusLoading(false);
    }
  };

  const submitDefect = () => {
    if (!defectForm.title.trim() || !defectForm.description.trim() || !defectForm.reportedBy.trim()) {
      Alert.alert('Required', 'Please fill in all required fields (Title, Description, and Reporter).');
      return;
    }
    if (!equipment) return;

    setDefectLoading(true);
    const db = getDB();
    try {
      db.runSync(`
        INSERT INTO Defects (equipment_id, reported_by, title, description, priority, status, report_date)
        VALUES (?, ?, ?, ?, ?, 'Open', datetime('now'))
      `, [equipment.id, defectForm.reportedBy, defectForm.title, defectForm.description, defectForm.priority]);

      Alert.alert('Success', 'Defect report has been saved and maintenance notified.');
      setShowDefectModal(false);
      setDefectForm({ title: '', description: '', priority: 'Medium', reportedBy: '' });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save defect report.');
    } finally {
      setDefectLoading(false);
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'Active': return '#10B981';
      case 'Under Maintenance': return '#F59E0B';
      case 'Maintenance': return '#F59E0B';
      case 'Inactive': return '#6B7280';
      case 'Retired': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusBgColor = (status: string | undefined) => {
    switch (status) {
      case 'Active': return '#ECFDF5';
      case 'Under Maintenance': return '#FFFBEB';
      case 'Maintenance': return '#FFFBEB';
      case 'Inactive': return '#F3F4F6';
      case 'Retired': return '#FEF2F2';
      default: return '#F3F4F6';
    }
  };

  const handleUseSpare = () => {
    if (!selectedSpare || !equipment) return;
    const qty = parseInt(useQuantity, 10);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity.');
      return;
    }
    if (qty > selectedSpare.available_quantity) {
      Alert.alert('Insufficient Stock', `Only ${selectedSpare.available_quantity} available.`);
      return;
    }
    if (!useMaintainer.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    const db = getDB();
    try {
      db.withTransactionSync(() => {
        db.runSync(`
          INSERT INTO Spare_Usage (spare_id, equipment_id, quantity_used, maintainer_name, used_date)
          VALUES (?, ?, ?, ?, datetime('now'))
        `, [selectedSpare.spare_id, equipment.id, qty, useMaintainer.trim()]);

        db.runSync(`
          UPDATE Spare_Parts 
          SET available_quantity = available_quantity - ? 
          WHERE id = ?
        `, [qty, selectedSpare.spare_id]);
      });

      setShowUsageModal(false);
      setUseQuantity('1');
      setUseMaintainer('');
      loadDetails(equipment.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record usage.');
    }
  };

  const loadAvailableSpares = () => {
    if (!equipment) return;
    const db = getDB();
    try {
      const spares = db.getAllSync<any>(`
        SELECT sp.* FROM Spare_Parts sp
        WHERE sp.id NOT IN (
          SELECT spare_id FROM Equipment_Spares WHERE equipment_id = ?
        )
      `, [equipment.id]);
      setAvailableSpares(spares);
      setShowAssignModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignSpare = (spareId: number) => {
    if (!equipment) return;
    if (!linkMaintainerName.trim()) {
      Alert.alert('Required', 'Please enter your name for "Linked By".');
      return;
    }
    const db = getDB();
    try {
      db.withTransactionSync(() => {
        // Link the spare to the equipment
        db.runSync(
          'INSERT INTO Equipment_Spares (equipment_id, spare_id, linked_by) VALUES (?, ?, ?)',
          [equipment.id, spareId, linkMaintainerName.trim()]
        );

        // Record usage (auto-deduct 1 unit for immediate setup/use)
        db.runSync(`
          INSERT INTO Spare_Usage (spare_id, equipment_id, quantity_used, maintainer_name, used_date)
          VALUES (?, ?, 1, ?, datetime('now'))
        `, [spareId, equipment.id, linkMaintainerName.trim()]);

        // Deduct from stock
        db.runSync(`
          UPDATE Spare_Parts 
          SET available_quantity = available_quantity - 1 
          WHERE id = ?
        `, [spareId]);
      });

      setShowAssignModal(false);
      setLinkMaintainerName('');
      loadDetails(equipment.id);
      Alert.alert('Success', 'Part linked and 1 unit deducted from stock for initial use.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to assign part. Ensure there is at least 1 unit in stock.');
    }
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (!equipment) return;
    setStatusLoading(true);
    const db = getDB();
    try {
      db.runSync(
        'UPDATE Equipment SET status = ? WHERE id = ?',
        [newStatus, equipment.id]
      );
      setShowStatusModal(false);
      loadDetails(equipment.id);
      Alert.alert('Success', `Equipment status updated to ${newStatus}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading equipment details...</Text>
      </View>
    );
  }

  if (!equipment) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATHA</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Asset Details</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Equipment Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.equipId, { color: theme.colors.primary, backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}>{equipment.equipment_id}</Text>
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: getStatusBgColor(equipment.status) }]}
              onPress={() => setShowStatusModal(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(equipment.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(equipment.status) }]}>{equipment.status}</Text>
              <Ionicons name="create-outline" size={14} color={getStatusColor(equipment.status)} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.equipName, { color: theme.colors.text }]}>{equipment.name}</Text>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Section / System</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.section || 'N/A'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Location</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.location || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Manufacturer</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.manufacturer || 'N/A'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Model</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.model_number || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Serial Number</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.serial_number || 'N/A'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Installation Date</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.installation_date || 'N/A'}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, styles.maintenanceRow, { borderTopColor: theme.colors.border }]}>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Last Routine</Text>
                <View style={[styles.dateBadge, { backgroundColor: theme.colors.background }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  <Text style={[styles.value, styles.lastMaintenanceText, { color: theme.colors.success }]}>{lastMaintenance}</Text>
                </View>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Next Routine</Text>
                <View style={[styles.dateBadge, { backgroundColor: theme.colors.background }]}>
                  <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
                  <Text style={[styles.value, styles.nextMaintenanceText, { color: theme.colors.error }]}>{nextMaintenance}</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.historyButton, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', borderColor: theme.dark ? '#1E40AF' : '#DBEAFE' }]}
            onPress={() => router.push({
              pathname: '/routine-history',
              params: { equipmentId: equipment.equipment_id, equipmentName: equipment.name }
            })}
          >
            <View style={styles.historyButtonContent}>
              <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.historyButtonText, { color: theme.colors.primary }]}>View Full Routine History</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Routines */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Routines</Text>
            <View style={[styles.sectionBadge, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.sectionBadgeText, { color: theme.colors.textSecondary }]}>{schedules.length}</Text>
            </View>
          </View>

          {schedules.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No schedules assigned.</Text>
            </View>
          ) : (
            schedules.map(sched => {
              const dateStr = sched.next_maintenance ? sched.next_maintenance.split(' ')[0] : 'Pending';
              const curDateStr = new Date().toISOString().split('T')[0];
              const isOverdue = dateStr !== 'Pending' && dateStr < curDateStr;
              const isFuture = dateStr !== 'Pending' && dateStr > curDateStr;
              const isToday = dateStr === curDateStr;

              return (
                <View key={sched.id} style={[styles.scheduleItem, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.scheduleInfo}>
                    <View style={styles.scheduleTypeContainer}>
                      <View style={[
                        styles.scheduleDot, 
                        isOverdue ? { backgroundColor: theme.colors.error } : (isFuture ? { backgroundColor: theme.colors.success } : { backgroundColor: theme.colors.warning })
                      ]} />
                      <Text style={[styles.scheduleType, { color: theme.colors.text }]}>{sched.schedule_type} Routine</Text>
                    </View>
                    <Text style={[styles.scheduleDate, { color: theme.colors.textSecondary }, isOverdue && { color: theme.colors.error, fontWeight: 'bold' }]}>
                      {isOverdue ? 'Overdue: ' : (isToday ? 'Due Today: ' : 'Next Due: ')}{dateStr}
                    </Text>
                    {isFuture && (
                      <View style={styles.lockBadge}>
                        <Ionicons name="checkmark-done" size={14} color={theme.colors.success} />
                        <Text style={[styles.lockText, { color: theme.colors.textSecondary }]}>Completed (Next: {dateStr})</Text>
                      </View>
                    )}
                  </View>
                  {(!sched.task_count || sched.task_count === 0) ? null : (
                  <TouchableOpacity
                    style={[styles.executeButton, isFuture && styles.executeButtonCompleted]}
                    onPress={() => router.push({
                      pathname: '/routine-execute',
                      params: {
                        id: sched.id.toString(),
                        equipment_name: equipment.name,
                        equipment_id: equipment.equipment_id,
                        schedule_type: sched.schedule_type
                      }
                    })}
                  >
                    <Text style={[styles.executeButtonText, isFuture && styles.executeButtonTextCompleted]}>
                      {isFuture ? 'Completed' : 'Execute'}
                    </Text>
                    <Ionicons
                      name={isFuture ? "checkmark-outline" : "arrow-forward"}
                      size={16}
                      color={isFuture ? theme.colors.success : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Linked Spare Parts */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Linked Spare Parts</Text>
              <View style={[styles.sectionBadge, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.sectionBadgeText, { color: theme.colors.textSecondary }]}>{spares.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.linkSpareActionBtn, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', borderColor: theme.dark ? '#1E40AF' : '#DBEAFE' }]}
              onPress={loadAvailableSpares}
            >
              <Ionicons name="add" size={16} color={theme.colors.primary} />
              <Text style={[styles.linkSpareActionText, { color: theme.colors.primary }]}>Link Spare</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.defectButton, { backgroundColor: theme.dark ? '#450a0a' : '#FEF2F2', borderColor: theme.dark ? '#7f1d1d' : '#FEE2E2' }]}
              onPress={() => setShowDefectModal(true)}
            >
              <Ionicons name="warning-outline" size={18} color={theme.colors.error} />
              <Text style={[styles.defectButtonText, { color: theme.colors.error }]}>Report Issue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.statusButton, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', borderColor: theme.dark ? '#1E40AF' : '#DBEAFE' }]}
              onPress={() => setShowStatusModal(true)}
            >
              <Ionicons name="options-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.statusButtonText, { color: theme.colors.primary }]}>Update Status</Text>
            </TouchableOpacity>
          </View>

          {spares.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No spares registered for this equipment.</Text>
            </View>
          ) : (
            spares.map(spare => {
              const stockStatus = spare.available_quantity <= 0 ? 'Out of Stock' :
                (spare.available_quantity <= spare.minimum_quantity ? 'Low Stock' : 'In Stock');
              const isDepleted = spare.available_quantity <= 0;
              const statusColor = isDepleted ? '#EF4444' :
                (spare.available_quantity <= spare.minimum_quantity ? '#F59E0B' : '#10B981');

              return (
                <View key={spare.id} style={[styles.spareItem, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.spareInfo}>
                    <Text style={[styles.spareName, { color: theme.colors.text }]}>{spare.name}</Text>
                    <View style={styles.spareMeta}>
                      <Text style={[styles.sparePartNumber, { color: theme.colors.textSecondary }]}>P/N: {spare.part_number}</Text>
                      <View style={[styles.stockBadge, { backgroundColor: `${statusColor}25` }]}>
                        <View style={[styles.stockDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.stockText, { color: statusColor }]}>{stockStatus}</Text>
                      </View>
                    </View>
                    <Text style={[styles.spareQuantity, { color: theme.colors.textSecondary }]}>Available: {spare.available_quantity} units</Text>
                    {spare.available_quantity <= spare.minimum_quantity && (
                      <Text style={[styles.minimumText, { color: theme.colors.warning }]}>Min. required: {spare.minimum_quantity}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.stockBadge, { backgroundColor: theme.colors.background }]}>
                      <Text style={[styles.stockText, { color: theme.colors.textSecondary }]}>{spare.available_quantity} in stock</Text>
                    </View>
                    {spare.linked_by && (
                      <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Linked by: {spare.linked_by}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.useButton, { backgroundColor: theme.colors.success }, isDepleted && styles.useButtonDisabled]}
                    disabled={isDepleted}
                    onPress={() => {
                      setSelectedSpare(spare);
                      setShowUsageModal(true);
                    }}
                  >
                    <Ionicons name="swap-vertical" size={16} color={isDepleted ? theme.colors.textSecondary : "#FFFFFF"} />
                    <Text style={[styles.useButtonText, isDepleted && styles.useButtonTextDisabled]}>Use</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Usage History */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Usage History</Text>
            <View style={[styles.sectionBadge, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.sectionBadgeText, { color: theme.colors.textSecondary }]}>{usageHistory.length}</Text>
            </View>
          </View>

          {usageHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No consumption history found.</Text>
            </View>
          ) : (
            usageHistory.map(record => (
              <View key={record.id} style={[styles.historyRow, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historySpareName, { color: theme.colors.text }]}>{record.spare_name}</Text>
                  <Text style={[styles.historyDetail, { color: theme.colors.textSecondary }]}>
                    {record.quantity_used} unit(s) • {record.maintainer_name}
                  </Text>
                </View>
                <Text style={[styles.historyDate, { color: theme.colors.textSecondary }]}>
                  {record.used_date.split(' ')[0]}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Usage Modal */}
      <Modal visible={showUsageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Record Usage</Text>
              <TouchableOpacity onPress={() => { setShowUsageModal(false); setUseQuantity('1'); setUseMaintainer(''); }}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedSpare && (
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>
                Consuming <Text style={[styles.modalHighlight, { color: theme.colors.primary }]}>{selectedSpare.name}</Text> for {equipment?.name}
              </Text>
            )}

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Quantity (Max: {selectedSpare?.available_quantity})</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={useQuantity}
                onChangeText={setUseQuantity}
                keyboardType="number-pad"
                placeholder="Enter quantity"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Maintainer Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.textSecondary}
                value={useMaintainer}
                onChangeText={setUseMaintainer}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { backgroundColor: theme.colors.background }]}
                onPress={() => { setShowUsageModal(false); setUseQuantity('1'); setUseMaintainer(''); }}
              >
                <Text style={[styles.modalBtnCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleUseSpare}>
                <Text style={styles.modalBtnSubmitText}>Withdraw Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Spare Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.assignModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Assign Spare Part</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Select a spare part to link with this equipment</Text>

            <ScrollView style={styles.assignList} showsVerticalScrollIndicator={false}>
              {availableSpares.length === 0 ? (
                <View style={styles.emptyAssign}>
                  <Ionicons name="cube-outline" size={40} color="#E5E7EB" />
                  <Text style={styles.emptyAssignText}>No available spares to assign</Text>
                </View>
              ) : (
                availableSpares.map(spare => (
                  <View key={spare.id} style={[styles.spareAssignRow, { borderBottomColor: theme.colors.border }]}>
                    <View style={{flex: 1}}>
                      <Text style={[styles.assignSpareName, { color: theme.colors.text }]}>{spare.name}</Text>
                      <Text style={[styles.assignSpareDetail, { color: theme.colors.textSecondary }]}>{spare.part_number} • {spare.available_quantity} in stock</Text>
                      <TextInput 
                        style={{
                          backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, 
                          borderRadius: 8, padding: 8, fontSize: 13, marginTop: 8, color: theme.colors.text
                        }}
                        placeholder="Maintainer Name (Linked By)"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={linkMaintainerName}
                        onChangeText={setLinkMaintainerName}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.addSpareBtn, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}
                      onPress={() => handleAssignSpare(spare.id)}
                    >
                      <Text style={[styles.addSpareBtnText, { color: theme.colors.primary }]}>Link & Use 1</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Defect Reporting Modal */}
      <Modal visible={showDefectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.defectModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Report Defect</Text>
              <TouchableOpacity onPress={() => setShowDefectModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>
              Report an issue with <Text style={[styles.modalHighlight, { color: theme.colors.primary }]}>{equipment?.name}</Text>
            </Text>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Issue Title</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. Unusual noise from motor"
                placeholderTextColor={theme.colors.textSecondary}
                value={defectForm.title}
                onChangeText={t => setDefectForm(f => ({ ...f, title: t }))}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Priority</Text>
              <View style={styles.priorityContainer}>
                {['Low', 'Medium', 'High', 'Critical'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityChip,
                      defectForm.priority === p && styles.priorityChipActive,
                      defectForm.priority === p && { backgroundColor: p === 'Critical' ? '#EF4444' : '#2563EB' }
                    ]}
                    onPress={() => setDefectForm(f => ({ ...f, priority: p }))}
                  >
                    <Text style={[
                      styles.priorityChipText,
                      defectForm.priority === p && styles.priorityChipTextActive
                    ]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Reported By *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.textSecondary}
                value={defectForm.reportedBy}
                onChangeText={t => setDefectForm(f => ({ ...f, reportedBy: t }))}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Detailed Description</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Describe the problem in detail..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={4}
                value={defectForm.description}
                onChangeText={t => setDefectForm(f => ({ ...f, description: t }))}
              />
            </View>

            <TouchableOpacity
              style={[styles.defectSubmitBtn, defectLoading && styles.buttonDisabled]}
              onPress={submitDefect}
              disabled={defectLoading}
            >
              <Text style={styles.defectSubmitText}>
                {defectLoading ? 'Submitting...' : 'Submit Defect Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Update Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Change operational status for {equipment?.name}</Text>

            <View style={styles.statusOptions}>
              {['Active', 'Under Maintenance', 'Inactive'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    tempStatus === status && styles.statusOptionActive
                  ]}
                  onPress={() => setTempStatus(status)}
                >
                  <View style={styles.statusOptionLeft}>
                    <View style={[styles.statusOptionDot, { backgroundColor: getStatusColor(status) }]} />
                    <Text style={[
                      styles.statusOptionText,
                      { color: theme.colors.text },
                      tempStatus === status && [styles.statusOptionTextActive, { color: theme.colors.primary }]
                    ]}>
                      {status}
                    </Text>
                  </View>
                  {tempStatus === status && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalBtnSubmit, styles.statusSubmitBtn, statusLoading && styles.buttonDisabled]}
              onPress={() => handleUpdateStatus(tempStatus)}
              disabled={statusLoading}
            >
              <Text style={styles.modalBtnSubmitText}>
                {statusLoading ? 'Updating...' : 'Confirm Status Change'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  headerTitleContainer: {
    alignItems: 'center'
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '500'
  },
  headerRight: {
    width: 40
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  equipId: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden'
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  equipName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    lineHeight: 34
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16
  },
  infoGrid: {
    gap: 12
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  maintenanceRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  infoCol: {
    flex: 1
  },
  label: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  value: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600'
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  lastMaintenanceText: {
    color: '#059669'
  },
  nextMaintenanceText: {
    color: '#DC2626'
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  historyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB'
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827'
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkSpareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  linkSpareActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  sectionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500'
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  scheduleInfo: {
    flex: 1,
    paddingRight: 12
  },
  scheduleTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  scheduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  scheduleDotDue: {
    backgroundColor: '#F59E0B'
  },
  scheduleDotFuture: {
    backgroundColor: '#9CA3AF'
  },
  scheduleType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  scheduleDate: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 16
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginLeft: 16
  },
  lockText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 6
  },
  executeButtonCompleted: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  executeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13
  },
  executeButtonTextCompleted: {
    color: '#059669'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1
  },
  defectButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2'
  },
  defectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444'
  },
  statusButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE'
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB'
  },
  spareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  historyInfo: {
    flex: 1
  },
  historySpareName: {
    fontSize: 14,
    fontWeight: '600'
  },
  historyDetail: {
    fontSize: 12,
    marginTop: 2
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '500'
  },
  spareInfo: {
    flex: 1,
    paddingRight: 12
  },
  spareName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4
  },
  spareMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  sparePartNumber: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  stockText: {
    fontSize: 10,
    fontWeight: '600'
  },
  spareQuantity: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500'
  },
  minimumText: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 2,
    fontWeight: '500'
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    gap: 4
  },
  useButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  useButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13
  },
  useButtonTextDisabled: {
    color: '#9CA3AF'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24
  },
  assignModalContent: {
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827'
  },
  modalSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20
  },
  modalHighlight: {
    fontWeight: '600',
    color: '#2563EB'
  },
  modalField: {
    marginBottom: 16
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginLeft: 4
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: '#111827'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center'
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563'
  },
  modalBtnSubmit: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    alignItems: 'center'
  },
  modalBtnSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  assignList: {
    maxHeight: 400
  },
  emptyAssign: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12
  },
  emptyAssignText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  assignItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  assignItemInfo: {
    flex: 1
  },
  assignItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4
  },
  assignItemPart: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2
  },
  assignItemQty: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500'
  },
  spareAssignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  assignSpareName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4
  },
  assignSpareDetail: {
    fontSize: 13,
    color: '#6B7280'
  },
  addSpareBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  addSpareBtnText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 13
  },
  defectModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    maxHeight: '90%'
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  priorityChipActive: {
    borderColor: 'transparent'
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563'
  },
  priorityChipTextActive: {
    color: '#FFFFFF'
  },
  defectSubmitBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8
  },
  defectSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  statusOptions: {
    gap: 8,
    marginTop: 8
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  statusOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE'
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  statusOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4B5563'
  },
  statusOptionTextActive: {
    color: '#1E40AF',
    fontWeight: '600'
  },
  statusSubmitBtn: {
    marginTop: 20
  }
});