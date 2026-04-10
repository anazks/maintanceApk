import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import { NativeModules } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getDB } from '../database';
import { handleMessage } from '../services/chatService';

const renderMarkdown = (text: string, baseStyle: any) => {
  if (!text) return null;
  // Split by bold (**bold**) or italic (*italic*)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={[{ fontWeight: 'bold' }, baseStyle]}>{part.slice(2, -2)}</Text>;
        } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <Text key={i} style={[{ fontStyle: 'italic' }, baseStyle]}>{part.slice(1, -1)}</Text>;
        }
        return <Text key={i} style={baseStyle}>{part}</Text>;
      })}
    </Text>
  );
};

const { width } = Dimensions.get('window');

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface Equipment {
  id: number;
  equipment_id: string;
  name: string;
  section: string;
  location: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  installation_date?: string;
  status?: string;
  maintained_by?: string;
  maintenance_start_date?: string;
  expected_completion_date?: string;
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

interface Troubleshooting {
  id: number;
  equipment_id: number | null;
  category: string;
  problem: string;
  solution: string;
}

export default function EquipmentDetails() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { id } = useLocalSearchParams();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [spares, setSpares] = useState<AssignedSpare[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastMaintenance, setLastMaintenance] = useState<string>('N/A');
  const [nextMaintenance, setNextMaintenance] = useState<string>('N/A');
  const [associatedVessels, setAssociatedVessels] = useState<{ id: number, name: string, type: string }[]>([]);

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
  const [customStatus, setCustomStatus] = useState('');

  // Maintenance Details State
  const [maintDetails, setMaintDetails] = useState({
    maintainedBy: '',
    startDate: new Date().toISOString().split('T')[0],
    expectedFinish: '',
    scheduleAlert: true
  });

  // Calendar Modal State
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'finish'>('start');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Defect Reporting Modal
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectLoading, setDefectLoading] = useState(false);
  const [defectForm, setDefectForm] = useState({ title: '', description: '', priority: 'Medium', reportedBy: '' });

  // Edit Equipment Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    section: '',
    location: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    installation_date: '',
    equipment_id: ''
  });

  const [hasPDF, setHasPDF] = useState(false);

  // Troubleshooting State
  const [troubleshooting, setTroubleshooting] = useState<Troubleshooting[]>([]);
  const [showTroubleModal, setShowTroubleModal] = useState(false);
  const [troubleLoading, setTroubleLoading] = useState(false);
  const [troubleForm, setTroubleForm] = useState({
    problem: '',
    solution: '',
    category: 'General',
    isGeneral: true
  });
  const [editTroubleId, setEditTroubleId] = useState<number | null>(null);

  // Chat Interface State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = React.useRef<ScrollView>(null);

  const submitChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    // Snapshot the chat history before appending the current message
    const historySnapshot = [...chatMessages];
    
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const aiResponse = await handleMessage(userMsg, equipment?.id?.toString(), historySnapshot);
      setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + e.message }]);
    } finally {
      setChatLoading(false);
    }
  };

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
        setTempStatus(item.status || 'Active');
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

        const vessels = db.getAllSync<{ id: number, name: string, type: string }>(`
          SELECT v.* FROM Vessels v
          JOIN Equipment_Vessels ev ON v.id = ev.vessel_id
          WHERE ev.equipment_id = ?
        `, [item.id]);
        setAssociatedVessels(vessels);

        // Load Troubleshooting Guides
        const trouble = db.getAllSync<Troubleshooting>(`
          SELECT * FROM Troubleshooting_Guides 
          WHERE equipment_id = ? OR equipment_id IS NULL 
          ORDER BY equipment_id DESC, created_at DESC
        `, [item.id]);
        setTroubleshooting(trouble);

        const pdfDoc = db.getFirstSync<{id: number}>('SELECT id FROM Equipment_Documents WHERE equipment_id = ?', [item.id]);
        setHasPDF(!!pdfDoc);

      } else {
        Alert.alert('Error', 'Equipment not found.');
        router.back();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load details.');
    } finally {
      setLoading(false);
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
      default: return '#2563EB'; // Blue for custom
    }
  };

  const getStatusBgColor = (status: string | undefined) => {
    switch (status) {
      case 'Active': return '#ECFDF5';
      case 'Under Maintenance': return '#FFFBEB';
      case 'Maintenance': return '#FFFBEB';
      case 'Inactive': return '#F3F4F6';
      case 'Retired': return '#FEF2F2';
      default: return '#EFF6FF'; // Light blue for custom
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

  const handleUpdateStatus = async (newStatus: string) => {
    if (!equipment) return;
    setStatusLoading(true);
    const db = getDB();
    try {
      if (newStatus === 'Under Maintenance' || newStatus === 'Maintenance') {
        if (!maintDetails.maintainedBy.trim()) {
          Alert.alert('Required', 'Please enter who is maintaining this equipment.');
          setStatusLoading(false);
          return;
        }

        db.runSync(
          'UPDATE Equipment SET status = ?, maintained_by = ?, maintenance_start_date = ?, expected_completion_date = ? WHERE id = ?',
          [newStatus, maintDetails.maintainedBy.trim(), maintDetails.startDate, maintDetails.expectedFinish, equipment.id]
        );

        if (maintDetails.scheduleAlert && maintDetails.expectedFinish) {
          const finishDate = new Date(maintDetails.expectedFinish);
          const now = new Date();

          if (finishDate > now) {
            // Calculate seconds from now to the expected finish date
            const secondsInFuture = Math.floor((finishDate.getTime() - now.getTime()) / 1000);

            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'âš¡ Maintenance Completion Due',
                body: `Maintenance for ${equipment.name} is expected to be completed today.`,
                data: { equipmentId: equipment.id },
                sound: 'default',
              },
              trigger: {
                // Using TIME_INTERVAL as it's more reliable in this SDK version
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.max(secondsInFuture, 1) // Ensure at least 1 second
              },
            });
          }
        }
      } else {
        const finalStatus = newStatus === 'Custom...' ? customStatus : newStatus;
        if (newStatus === 'Custom...' && !customStatus.trim()) {
          Alert.alert('Required', 'Please enter a custom status name.');
          setStatusLoading(false);
          return;
        }

        db.runSync(
          'UPDATE Equipment SET status = ?, maintained_by = NULL, maintenance_start_date = NULL, expected_completion_date = NULL WHERE id = ?',
          [finalStatus, equipment.id]
        );
      }

      setShowStatusModal(false);
      loadDetails(equipment.id);
      Alert.alert('Success', `Equipment status updated successfully.`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleEditOpen = () => {
    if (!equipment) return;
    setEditForm({
      name: equipment.name,
      section: equipment.section || '',
      location: equipment.location || '',
      manufacturer: equipment.manufacturer || '',
      model_number: equipment.model_number || '',
      serial_number: equipment.serial_number || '',
      installation_date: equipment.installation_date || '',
      equipment_id: equipment.equipment_id || ''
    });
    setShowEditModal(true);
  };

  const submitEdit = () => {
    if (!equipment) return;
    if (!editForm.name.trim()) {
      Alert.alert('Required', 'Equipment name is required.');
      return;
    }
    const db = getDB();
    try {
      db.runSync(`
        UPDATE Equipment 
        SET equipment_id = ?, name = ?, section = ?, location = ?, manufacturer = ?, model_number = ?, serial_number = ?, installation_date = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [editForm.equipment_id.trim(), editForm.name.trim(), editForm.section.trim(), editForm.location.trim(), editForm.manufacturer.trim(), editForm.model_number.trim(), editForm.serial_number.trim(), editForm.installation_date.trim(), equipment.id]);

      Alert.alert('Success', 'Equipment details updated.');
      setShowEditModal(false);
      loadDetails(equipment.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update equipment.');
    }
  };

  const submitTroubleshooting = () => {
    if (!troubleForm.problem.trim() || !troubleForm.solution.trim()) {
      Alert.alert('Required', 'Please fill in both the problem and the solution.');
      return;
    }
    if (!equipment) return;

    setTroubleLoading(true);
    const db = getDB();
    try {
      if (editTroubleId) {
        db.runSync(`
          UPDATE Troubleshooting_Guides 
          SET category = ?, problem = ?, solution = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [troubleForm.category, troubleForm.problem.trim(), troubleForm.solution.trim(), editTroubleId]);
        Alert.alert('Success', 'Troubleshooting guide updated successfully.');
      } else {
        db.runSync(`
          INSERT INTO Troubleshooting_Guides (equipment_id, category, problem, solution, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `, [troubleForm.isGeneral ? null : equipment.id, troubleForm.category, troubleForm.problem.trim(), troubleForm.solution.trim()]);
        Alert.alert('Success', 'Troubleshooting guide added successfully.');
      }

      setShowTroubleModal(false);
      setTroubleForm({ problem: '', solution: '', category: 'General', isGeneral: true });
      setEditTroubleId(null);
      loadDetails(equipment.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save troubleshooting guide.');
    } finally {
      setTroubleLoading(false);
    }
  };

  const handleDeleteTrouble = (troubleId: number) => {
    Alert.alert(
      'Delete Guide',
      'Are you sure you want to delete this troubleshooting method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const db = getDB();
            try {
              db.runSync('DELETE FROM Troubleshooting_Guides WHERE id = ?', [troubleId]);
              if (equipment) loadDetails(equipment.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to delete troubleshooting guide.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteEquipment = () => {
    if (!equipment) return;
    Alert.alert(
      'Delete Equipment',
      `Are you sure you want to delete ${equipment.name}? This action cannot be undone and will remove all associated maintenance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const db = getDB();
            try {
              db.withTransactionSync(() => {
                // Delete related records
                db.runSync('DELETE FROM Maintenance_Log_Items WHERE log_id IN (SELECT id FROM Maintenance_Log WHERE equipment_id = ?)', [equipment.id]);
                db.runSync('DELETE FROM Maintenance_Log WHERE equipment_id = ?', [equipment.id]);
                db.runSync('DELETE FROM Checklist_Items WHERE schedule_id IN (SELECT id FROM Maintenance_Schedule WHERE equipment_id = ?)', [equipment.id]);
                db.runSync('DELETE FROM Maintenance_Schedule WHERE equipment_id = ?', [equipment.id]);
                db.runSync('DELETE FROM Defects WHERE equipment_id = ?', [equipment.id]);
                db.runSync('DELETE FROM Equipment_Spares WHERE equipment_id = ?', [equipment.id]);
                db.runSync('DELETE FROM Equipment_Vessels WHERE equipment_id = ?', [equipment.id]);
                db.runSync('DELETE FROM Spare_Usage WHERE equipment_id = ?', [equipment.id]);

                // Finally delete the equipment
                db.runSync('DELETE FROM Equipment WHERE id = ?', [equipment.id]);
              });
              Alert.alert('Deleted', 'Equipment has been removed.');
              router.back();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to delete equipment.');
            }
          }
        }
      ]
    );
  };

  const handleUploadPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const asset = result.assets[0];
      const fileUri = asset.uri;
      
      setLoading(true);
      if (!NativeModules.PdfExtractorModule) {
        Alert.alert('Error', 'PdfExtractorModule native library is not linked. Please build the Android app using Android Studio first.');
        setLoading(false);
        return;
      }
      
      const parsedText = await NativeModules.PdfExtractorModule.extractText(fileUri);
      
      if (!parsedText || parsedText.trim() === '') {
        Alert.alert('Warning', 'The uploaded PDF appears to be a scanned image or contains no readable text. The AI won\'t be able to read it.');
        // We will still save it so the UI explicitly shows the state or lets AI state it's empty
      }
      
      if (!equipment) return;
      const db = getDB();
      
      // Delete old PDF for this equipment before inserting
      db.runSync('DELETE FROM Equipment_Documents WHERE equipment_id = ?', [equipment.id]);
      
      db.runSync(
        'INSERT INTO Equipment_Documents (equipment_id, file_name, file_uri, parsed_text) VALUES (?, ?, ?, ?)',
        [equipment.id, asset.name, fileUri, parsedText]
      );
      
      Alert.alert('Success', 'PDF uploaded and processed. Chatbot can now read this manual!');
      loadDetails(equipment.id);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to read PDF: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper for Calendar
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
    const dateStr = selectedDate.toISOString().split('T')[0];

    if (calendarTarget === 'start') {
      setMaintDetails(prev => ({ ...prev, startDate: dateStr }));
    } else {
      setMaintDetails(prev => ({ ...prev, expectedFinish: dateStr }));
    }
    setShowCalendar(false);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + offset, 1);
    setCurrentCalendarDate(newDate);
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
          <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATA</Text>
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
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.section || 'Not specified'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Location</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.location || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Manufacturer</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.manufacturer || 'Not specified'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Model</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.model_number || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Serial Number</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.serial_number || 'Not specified'}</Text>
              </View>
              <View style={styles.infoCol}>
                {(equipment.status === 'Under Maintenance' || equipment.status === 'Maintenance') ? (
                  <>
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Maintained By</Text>
                    <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.maintained_by || 'Not specified'}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Installation Date</Text>
                    <Text style={[styles.value, { color: theme.colors.text }]}>{equipment.installation_date || 'Not specified'}</Text>
                  </>
                )}
              </View>
            </View>

            {(equipment.status === 'Under Maintenance' || equipment.status === 'Maintenance') && equipment.expected_completion_date && (
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <View style={[styles.infoCol, { backgroundColor: theme.dark ? '#1E3A8A20' : '#EFF6FF', padding: 8, borderRadius: 8 }]}>
                  <Text style={[styles.label, { color: theme.colors.primary, fontSize: 11 }]}>Expected Completion</Text>
                  <Text style={[styles.value, { color: theme.colors.primary, fontWeight: '700' }]}>{equipment.expected_completion_date}</Text>
                </View>
              </View>
            )}

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

            {associatedVessels.length > 0 && (
              <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16, marginTop: 8 }]}>
                <View style={styles.infoCol}>
                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Applicable Vessels</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {associatedVessels.map(v => (
                      <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                        <Ionicons name={v.type === 'Ship' ? 'boat-outline' : 'construct-outline'} size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>{v.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
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
                  {(() => {
                    const isDefault = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'].includes(sched.schedule_type);
                    const hasTasks = (sched.task_count && sched.task_count > 0);
                    // Always show for custom routines, or if it has tasks
                    if (!isDefault || hasTasks) {
                      return (
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
                      );
                    }
                    return null;
                  })()}
                </View>
              );
            })
          )}
        </View>

        {/* Troubleshooting Guides */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.sectionHeader, { flexWrap: 'wrap', gap: 12 }]}>
            <View style={styles.sectionHeaderTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Troubleshooting Guides</Text>
              <View style={[styles.sectionBadge, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.sectionBadgeText, { color: theme.colors.textSecondary }]}>{troubleshooting.length}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                style={[styles.linkSpareActionBtn, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', borderColor: theme.dark ? '#1E40AF' : '#DBEAFE' }]}
                onPress={() => {
                  setChatMessages([]);
                  setShowChatModal(true);
                }}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.linkSpareActionText, { color: theme.colors.primary }]}>Chat with AI</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.linkSpareActionBtn, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', borderColor: theme.dark ? '#1E40AF' : '#DBEAFE' }]}
              onPress={() => {
                setEditTroubleId(null);
                setTroubleForm({ problem: '', solution: '', category: 'General', isGeneral: true });
                setShowTroubleModal(true);
              }}
              >
                <Ionicons name="add" size={16} color={theme.colors.primary} />
                <Text style={[styles.linkSpareActionText, { color: theme.colors.primary }]}>Add Method</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.linkSpareActionBtn, { backgroundColor: theme.dark ? '#064E3B' : '#D1FAE5', borderColor: theme.dark ? '#047857' : '#A7F3D0' }]}
                onPress={handleUploadPDF}
              >
                <Ionicons name={hasPDF ? "checkmark-circle" : "document-attach-outline"} size={16} color={theme.colors.success} />
                <Text style={[styles.linkSpareActionText, { color: theme.colors.success }]}>
                  {hasPDF ? 'PDF Loaded' : 'Upload PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {troubleshooting.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="help-buoy-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No troubleshooting methods available.</Text>
            </View>
          ) : (
            troubleshooting.map(guide => (
              <View key={guide.id} style={[styles.troubleItem, { borderBottomColor: theme.colors.border }]}>
                <View style={[styles.troubleHeader, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={[styles.troubleCategoryBadge, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.troubleCategoryText, { color: theme.colors.primary }]}>
                      {guide.equipment_id ? 'EQUIPMENT' : 'GENERAL'} • {guide.category}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => {
                        setEditTroubleId(guide.id);
                        setTroubleForm({
                          problem: guide.problem,
                          solution: guide.solution,
                          category: guide.category || 'General',
                          isGeneral: !guide.equipment_id
                        });
                        setShowTroubleModal(true);
                      }}>
                      <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTrouble(guide.id)}>
                      <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.troubleProblem, { color: theme.colors.text }]}>{guide.problem}</Text>
                <Text style={[styles.troubleSolution, { color: theme.colors.textSecondary }]}>{guide.solution}</Text>
              </View>
            ))
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

          <View style={[styles.actionButtons, { marginTop: -8 }]}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton, { backgroundColor: theme.dark ? '#1e293b' : '#f8fafc', borderColor: theme.colors.border }]}
              onPress={handleEditOpen}
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.editButtonText, { color: theme.colors.primary }]}>Edit Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, { backgroundColor: theme.dark ? '#450a0a' : '#FEF2F2', borderColor: '#FECACA' }]}
              onPress={handleDeleteEquipment}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={[styles.deleteButtonText, { color: "#EF4444" }]}>Delete Asset</Text>
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
                    {record.quantity_used} unit(s) â€¢ {record.maintainer_name}
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Record Usage</Text>
                <TouchableOpacity onPress={() => { setShowUsageModal(false); setUseQuantity('1'); setUseMaintainer(''); }}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Assign Spare Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, styles.assignModalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Assign Spare Part</Text>
                <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Select a spare part to link with this equipment</Text>

              <ScrollView key="assign-list-scroll" style={styles.assignList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {availableSpares.length === 0 ? (
                  <View style={styles.emptyAssign}>
                    <Ionicons name="cube-outline" size={40} color="#E5E7EB" />
                    <Text style={styles.emptyAssignText}>No available spares to assign</Text>
                  </View>
                ) : (
                  availableSpares.map(spare => (
                    <View key={spare.id} style={[styles.spareAssignRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.assignSpareName, { color: theme.colors.text }]}>{spare.name}</Text>
                        <Text style={[styles.assignSpareDetail, { color: theme.colors.textSecondary }]}>{spare.part_number} â€¢ {spare.available_quantity} in stock</Text>
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
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Defect Reporting Modal */}
      <Modal visible={showDefectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.defectModalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Report Defect</Text>
                <TouchableOpacity onPress={() => setShowDefectModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Identifying an issue for {equipment?.name || 'this asset'}</Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Issue Title</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. Unusual noise from motor"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={defectForm.title}
                  onChangeText={t => setDefectForm(f => ({ ...f, title: t }))}
                />

                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Priority</Text>
                <View style={styles.priorityContainer}>
                  {['Low', 'Medium', 'High', 'Critical'].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }, defectForm.priority === p && [styles.priorityChipActive, { backgroundColor: theme.colors.primary, borderColor: 'transparent' }]]}
                      onPress={() => setDefectForm(f => ({ ...f, priority: p }))}
                    >
                      <Text style={[styles.priorityChipText, { color: theme.colors.textSecondary }, defectForm.priority === p && [styles.priorityChipTextActive, { color: '#FFFFFF' }]]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Reported By *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={defectForm.reportedBy}
                  onChangeText={t => setDefectForm(f => ({ ...f, reportedBy: t }))}
                />

                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Detailed Description</Text>
                <TextInput
                  style={[styles.modalInput, { height: 100, textAlignVertical: 'top', backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Describe the problem in detail..."
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  value={defectForm.description}
                  onChangeText={t => setDefectForm(f => ({ ...f, description: t }))}
                />

                <TouchableOpacity
                  style={[styles.defectSubmitBtn, { backgroundColor: theme.colors.error }, defectLoading && { opacity: 0.7 }]}
                  onPress={submitDefect}
                  disabled={defectLoading}
                >
                  <Text style={styles.defectSubmitText}>{defectLoading ? 'Saving...' : 'Submit Defect Report'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Status Update Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Update Status</Text>
                <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Change operational status for {equipment?.name}</Text>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                <View style={styles.statusOptions}>
                  {['Active', 'Under Maintenance', 'Inactive', 'Retired', 'Custom...'].map((status) => (
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

                {tempStatus === 'Custom...' && (
                  <View style={{ marginTop: 20 }}>
                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Custom Status Name *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                        placeholder="e.g., Awaiting Parts"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={customStatus}
                        onChangeText={setCustomStatus}
                      />
                    </View>
                  </View>
                )}

                {(tempStatus === 'Under Maintenance' || tempStatus === 'Maintenance') && (
                  <View style={{ marginTop: 10 }}>
                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Maintained To (Person/Team) *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                        placeholder="e.g., Engine Team / John Doe"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={maintDetails.maintainedBy}
                        onChangeText={t => setMaintDetails(prev => ({ ...prev, maintainedBy: t }))}
                      />
                    </View>

                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Start Date</Text>
                      <TouchableOpacity
                        style={[styles.datePickerTrigger, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                        onPress={() => { setCalendarTarget('start'); setShowCalendar(true); }}
                      >
                        <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                        <Text style={[styles.datePickerText, { color: maintDetails.startDate ? theme.colors.text : theme.colors.textSecondary }]}>
                          {maintDetails.startDate || "Select Start Date"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Expected Completion Date</Text>
                      <TouchableOpacity
                        style={[styles.datePickerTrigger, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                        onPress={() => { setCalendarTarget('finish'); setShowCalendar(true); }}
                      >
                        <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                        <Text style={[styles.datePickerText, { color: maintDetails.expectedFinish ? theme.colors.text : theme.colors.textSecondary }]}>
                          {maintDetails.expectedFinish || "Select Expected Date"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
                      onPress={() => setMaintDetails(prev => ({ ...prev, scheduleAlert: !prev.scheduleAlert }))}
                    >
                      <Ionicons
                        name={maintDetails.scheduleAlert ? "checkbox" : "square-outline"}
                        size={24}
                        color={maintDetails.scheduleAlert ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <Text style={{ marginLeft: 8, color: theme.colors.text, fontSize: 14 }}>Schedule alert on completion date</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.modalBtnSubmit, styles.statusSubmitBtn, statusLoading && styles.buttonDisabled]}
                  onPress={() => handleUpdateStatus(tempStatus)}
                  disabled={statusLoading}
                >
                  <Text style={styles.modalBtnSubmitText}>
                    {statusLoading ? 'Updating...' : 'Confirm Status Change'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
                const isSelected = (calendarTarget === 'start' && maintDetails.startDate === new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day).toISOString().split('T')[0]) ||
                  (calendarTarget === 'finish' && maintDetails.expectedFinish === new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day).toISOString().split('T')[0]);

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

      {/* Edit Equipment Modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.editModalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Equipment Details</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Updating information for {equipment?.equipment_id}</Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Equipment ID (Unique) *</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={editForm.equipment_id}
                    onChangeText={t => setEditForm(f => ({ ...f, equipment_id: t }))}
                    placeholder="e.g. EQP-001"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Equipment Name *</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={editForm.name}
                    onChangeText={t => setEditForm(f => ({ ...f, name: t }))}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Section / System</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={editForm.section}
                    placeholder="e.g. Propulsion"
                    placeholderTextColor={theme.colors.textSecondary}
                    onChangeText={t => setEditForm(f => ({ ...f, section: t }))}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Location</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={editForm.location}
                    placeholder="e.g. Engine Room"
                    placeholderTextColor={theme.colors.textSecondary}
                    onChangeText={t => setEditForm(f => ({ ...f, location: t }))}
                  />
                </View>

                <View style={[styles.infoRow, { gap: 12 }]}>
                  <View style={[styles.modalField, { flex: 1 }]}>
                    <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Manufacturer</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={editForm.manufacturer}
                      onChangeText={t => setEditForm(f => ({ ...f, manufacturer: t }))}
                    />
                  </View>
                  <View style={[styles.modalField, { flex: 1 }]}>
                    <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Model</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={editForm.model_number}
                      onChangeText={t => setEditForm(f => ({ ...f, model_number: t }))}
                    />
                  </View>
                </View>

                <View style={[styles.infoRow, { gap: 12 }]}>
                  <View style={[styles.modalField, { flex: 1 }]}>
                    <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Serial Number</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={editForm.serial_number}
                      onChangeText={t => setEditForm(f => ({ ...f, serial_number: t }))}
                    />
                  </View>
                  <View style={[styles.modalField, { flex: 1 }]}>
                    <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Installation Date</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                      value={editForm.installation_date}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.colors.textSecondary}
                      onChangeText={t => setEditForm(f => ({ ...f, installation_date: t }))}
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtnCancel, { backgroundColor: theme.colors.background }]}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={[styles.modalBtnCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSubmit} onPress={submitEdit}>
                    <Text style={styles.modalBtnSubmitText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Troubleshooting Modal */}
      <Modal visible={showTroubleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.defectModalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editTroubleId ? 'Edit Troubleshooting Method' : 'Add Troubleshooting Method'}
                </Text>
                <TouchableOpacity onPress={() => setShowTroubleModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Add a guide for {equipment?.name}</Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Category</Text>
                  <View style={styles.priorityContainer}>
                    {['General', 'Electrical', 'Mechanical', 'Operational'].map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.priorityChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }, troubleForm.category === c && [styles.priorityChipActive, { backgroundColor: theme.colors.primary, borderColor: 'transparent' }]]}
                        onPress={() => setTroubleForm(f => ({ ...f, category: c }))}
                      >
                        <Text style={[styles.priorityChipText, { color: theme.colors.textSecondary }, troubleForm.category === c && [styles.priorityChipTextActive, { color: '#FFFFFF' }]]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginLeft: 4 }}
                  onPress={() => setTroubleForm(prev => ({ ...prev, isGeneral: !prev.isGeneral }))}
                >
                  <Ionicons
                    name={troubleForm.isGeneral ? "checkbox" : "square-outline"}
                    size={22}
                    color={troubleForm.isGeneral ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={{ marginLeft: 8, color: theme.colors.text, fontSize: 14 }}>Mark as General Method (all assets)</Text>
                </TouchableOpacity>

                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Problem / Symptom *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. Motor overheating"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={troubleForm.problem}
                  onChangeText={t => setTroubleForm(f => ({ ...f, problem: t }))}
                />

                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>Solution / Steps *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 100, textAlignVertical: 'top', backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Describe the solution steps..."
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  value={troubleForm.solution}
                  onChangeText={t => setTroubleForm(f => ({ ...f, solution: t }))}
                />

                <TouchableOpacity
                  style={[styles.modalBtnSubmit, { backgroundColor: theme.colors.primary, marginTop: 24, paddingVertical: 16 }]}
                  onPress={submitTroubleshooting}
                  disabled={troubleLoading}
                >
                  <Text style={styles.modalBtnSubmitText}>
                    {troubleLoading ? 'Saving...' : editTroubleId ? 'Update Troubleshooting Method' : 'Save Troubleshooting Method'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChatModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%', flex: 1 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>AI Troubleshooter</Text>
                <Text style={styles.modalSub}>Ask questions based on PDF manuals.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              ref={chatScrollRef}
              style={{ flex: 1, marginBottom: 12 }} 
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {chatMessages.length === 0 && (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#9CA3AF' }}>Say hello to start troubleshooting!</Text>
              )}
              {chatMessages.map((msg, index) => (
                <View key={index} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#2563EB' : '#FFFFFF',
                  padding: 14,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: msg.role === 'user' ? 18 : 4,
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 18,
                  marginBottom: 12,
                  maxWidth: '85%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 1,
                  borderWidth: msg.role === 'ai' ? 1 : 0,
                  borderColor: '#F3F4F6'
                }}>
                  {renderMarkdown(msg.text, { 
                    color: msg.role === 'user' ? '#FFFFFF' : '#1F2937', 
                    fontSize: 15, 
                    lineHeight: 22 
                  })}
                </View>
              ))}
              {chatLoading && (
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#4B5563" />
                  <Text style={{ marginLeft: 8, color: '#4B5563' }}>AI is thinking...</Text>
                </View>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                placeholder="Describe the issue..."
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={submitChat}
                editable={!chatLoading}
              />
              <TouchableOpacity
                style={{ backgroundColor: '#2563EB', padding: 14, borderRadius: 16, opacity: chatLoading ? 0.5 : 1 }}
                onPress={submitChat}
                disabled={chatLoading}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Floating Chatbot Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.colors.primary }]} 
        onPress={() => setShowChatModal(true)}
      >
        <Ionicons name="chatbubble-ellipses" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
    fontWeight: '600',
    marginLeft: 4,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  datePickerText: {
    fontSize: 15,
    marginLeft: 10,
  },
  calendarContent: {
    width: width * 0.85,
    borderRadius: 24,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    marginBottom: 15,
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  calendarNavBtn: {
    padding: 5,
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarDayLabel: {
    width: (width * 0.85 - 40) / 7,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: (width * 0.85 - 40) / 7,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  calendarDayText: {
    fontSize: 14,
  },
  calendarCloseBtn: {
    marginTop: 15,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
  editButton: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0'
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB'
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444'
  },
  editModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    width: '90%',
    maxHeight: '90%'
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
    padding: 24,
    maxHeight: '95%'
  },

  assignModalContent: {
    maxHeight: '90%'
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
  },
  troubleItem: {
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  troubleHeader: {
    marginBottom: 8
  },
  troubleCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  troubleCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  troubleProblem: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  troubleSolution: {
    fontSize: 14,
    lineHeight: 20
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  }
});
