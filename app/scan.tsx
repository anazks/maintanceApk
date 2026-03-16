import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { getDB } from '../database';
import { useTheme } from '../context/ThemeContext';

export default function ScanEquipment() {
  const { theme } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [equipmentName, setEquipmentName] = useState<string>('');
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectLoading, setDefectLoading] = useState(false);
  const [defectForm, setDefectForm] = useState({ title: '', description: '', priority: 'Medium', reportedBy: '' });
  const [lastMaintenance, setLastMaintenance] = useState<{
    date: string,
    maintainer: string,
    remarks: string,
    tasks: { description: string, completed: boolean }[]
  } | null>(null);
  const [assignedRoutines, setAssignedRoutines] = useState<{ id: number, type: string, next_due: string, is_overdue: boolean, is_future: boolean }[]>([]);
  const [linkedSpares, setLinkedSpares] = useState<{ id: number, name: string, part_number: string, available_quantity: number, minimum_quantity: number }[]>([]);
  const router = useRouter();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string, data: string }) => {
    if (scanned || scanning) return;

    setScanned(true);
    setScanning(true);

    let parsedData: any = null;
    try {
      // Try to parse JSON data
      parsedData = JSON.parse(data);
      setScannedData(parsedData);
      lookupEquipment(parsedData?.id || data);
    } catch (e) {
      // If not JSON, treat as string
      const fallbackData = {
        id: data,
        type: 'QR Code',
        timestamp: new Date().toLocaleString()
      };
      setScannedData(fallbackData);
      lookupEquipment(data);
    }

    setShowDetails(true);
    setScanning(false);
  };

  const submitDefect = () => {
    if (!defectForm.title.trim() || !defectForm.description.trim() || !defectForm.reportedBy.trim()) {
      Alert.alert('Required', 'Please fill in all required fields (Title, Description, and Reporter).');
      return;
    }

    setDefectLoading(true);
    const db = getDB();
    try {
      const targetId = scannedData?.id || equipmentId;
      if (!targetId) throw new Error('No equipment ID found');

      db.runSync(`
        INSERT INTO Defects (equipment_id, reported_by, title, description, priority, status, report_date)
        VALUES (?, ?, ?, ?, ?, 'Open', datetime('now'))
      `, [targetId, defectForm.reportedBy, defectForm.title, defectForm.description, defectForm.priority]);

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

  const resetScanner = () => {
    setScanned(false);
    setShowDetails(false);
    setScannedData(null);
    setEquipmentId(null);
    setEquipmentName('');
    setEquipmentName('');
    setLastMaintenance(null);
    setAssignedRoutines([]);
    setLinkedSpares([]);
    setDefectForm({ title: '', description: '', priority: 'Medium', reportedBy: '' });
    setShowDefectModal(false);
  };

  const lookupEquipment = (idString: string) => {
    const db = getDB();
    try {
      const eq = db.getFirstSync<{ id: number, name: string }>(
        'SELECT id, name FROM Equipment WHERE equipment_id = ? OR id = ?',
        [idString, idString]
      );
      if (eq) {
        setEquipmentId(eq.id);
        setEquipmentName(eq.name);

        // Fetch last maintenance log
        const last = db.getFirstSync<{ id: number, maintenance_date: string, maintainer_name: string, remarks: string }>(
          'SELECT id, maintenance_date, maintainer_name, remarks FROM Maintenance_Log WHERE equipment_id = ? ORDER BY maintenance_date DESC LIMIT 1',
          [eq.id]
        );

        if (last) {
          const items = db.getAllSync<{ task_description: string, is_completed: number }>(`
            SELECT ci.task_description, mli.is_completed
            FROM Maintenance_Log_Items mli
            JOIN Checklist_Items ci ON mli.checklist_item_id = ci.id
            WHERE mli.log_id = ?
          `, [last.id]);

          setLastMaintenance({
            date: new Date(last.maintenance_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            maintainer: last.maintainer_name,
            remarks: last.remarks || '',
            tasks: items.map(i => ({
              description: i.task_description,
              completed: !!i.is_completed
            }))
          });
        }

        // Fetch all assigned routine schedules
        const routines = db.getAllSync<{ id: number, schedule_type: string, next_maintenance: string }>(
          'SELECT id, schedule_type, next_maintenance FROM Maintenance_Schedule WHERE equipment_id = ?',
          [eq.id]
        );

        const curDateStr = new Date().toISOString().split('T')[0];
        setAssignedRoutines(routines.map(r => {
          const nextDue = r.next_maintenance ? r.next_maintenance.split(' ')[0] : 'Unscheduled';
          return {
            id: r.id,
            type: r.schedule_type,
            next_due: nextDue,
            is_overdue: nextDue !== 'Unscheduled' && nextDue < curDateStr,
            is_future: nextDue !== 'Unscheduled' && nextDue > curDateStr
          };
        }));

        // Fetch linked spares
        const spares = db.getAllSync<{ id: number, name: string, part_number: string, available_quantity: number, minimum_quantity: number }>(`
          SELECT sp.id, sp.name, sp.part_number, sp.available_quantity, sp.minimum_quantity
          FROM Equipment_Spares es
          JOIN Spare_Parts sp ON es.spare_id = sp.id
          WHERE es.equipment_id = ?
        `, [eq.id]);
        setLinkedSpares(spares);
      }
    } catch (e) {
      console.error('Error looking up equipment:', e);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.messageText, { color: theme.colors.textSecondary }]}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="camera-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={[styles.messageText, { color: theme.colors.textSecondary }]}>No access to camera</Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            const getPermissions = async () => {
              const { status } = await Camera.requestCameraPermissionsAsync();
              setHasPermission(status === 'granted');
            };
            getPermissions();
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417', 'aztec', 'code128', 'code39', 'code93', 'ean13', 'ean8'],
        }}
        enableTorch={torchOn}
      />

      {/* Scanner Overlay */}
      <View style={styles.overlay}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={resetScanner}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.scannerTitle}>Scan Equipment QR</Text>
          <TouchableOpacity
            style={styles.torchButton}
            onPress={() => setTorchOn(!torchOn)}
          >
            <Ionicons
              name={torchOn ? "flash" : "flash-off"}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Scanner Frame */}
        <View style={styles.scannerFrameContainer}>
          <View style={styles.scannerFrame}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
          <Text style={styles.instructionText}>
            Align QR code within the frame
          </Text>
        </View>

        {/* Bottom Info */}
        <View style={styles.bottomInfo}>
          <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bottomInfoText}>
            Point camera at equipment QR code
          </Text>
        </View>
      </View>

      {/* Equipment Details Modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.successIconBadge}>
                  <Ionicons name="checkmark" size={18} color="#059669" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Asset Identified</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>Registry match found</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: theme.colors.background }]} onPress={() => setShowDetails(false)}>
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailsContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.cardAccent, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>{equipmentName || scannedData?.name || 'Unknown Asset'}</Text>
                <View style={styles.idRow}>
                  <Ionicons name="barcode-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.summaryId, { color: theme.colors.textSecondary }]}>{scannedData?.id || scannedData?.equipment_id || 'ID N/A'}</Text>
                </View>

                <View style={[styles.historyHighlight, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}>
                  <View style={[styles.historyIconBox, { backgroundColor: theme.dark ? '#1e40af' : '#DBEAFE' }]}>
                    <Ionicons name="time" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyLabel, { color: theme.colors.textSecondary }]}>Latest Maintenance</Text>
                    <Text style={[styles.historyValue, { color: theme.colors.text }]}>
                      {lastMaintenance ? `${lastMaintenance.date} • ${lastMaintenance.maintainer}` : 'No service record available'}
                    </Text>
                  </View>
                </View>

                {lastMaintenance && (
                  <View style={styles.lastLogSection}>
                    {lastMaintenance.tasks.length > 0 && (
                      <View style={styles.miniTasksContainer}>
                        <Text style={[styles.miniHeader, { color: theme.colors.textSecondary }]}>Tasks Performed</Text>
                        <View style={styles.tasksGrid}>
                          {lastMaintenance.tasks.slice(0, 4).map((t, idx) => (
                            <View key={idx} style={styles.miniTaskRow}>
                              <Ionicons
                                name={t.completed ? "checkmark-circle" : "alert-circle"}
                                size={14}
                                color={t.completed ? theme.colors.success : theme.colors.error}
                              />
                              <Text style={[styles.miniTaskText, { color: theme.colors.text }]} numberOfLines={1}>{t.description}</Text>
                            </View>
                          ))}
                        </View>
                        {lastMaintenance.tasks.length > 4 && (
                          <Text style={styles.moreTasksText}>+ {lastMaintenance.tasks.length - 4} more items...</Text>
                        )}
                      </View>
                    )}

                    {lastMaintenance.remarks && (
                      <View style={styles.miniRemarksContainer}>
                        <Text style={[styles.miniHeader, { color: theme.colors.textSecondary }]}>Inspector Remarks</Text>
                        <Text style={[styles.miniRemarksText, { color: theme.colors.text }]}>"{lastMaintenance.remarks}"</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.fullHistoryLink}
                      onPress={() => {
                        setShowDetails(false);
                        router.push({
                          pathname: '/routine-history',
                          params: {
                            equipmentId: (scannedData?.id || scannedData?.equipment_id || equipmentId)?.toString(),
                            equipmentName: equipmentName || scannedData?.name
                          }
                        });
                      }}
                    >
                      <Text style={[styles.fullHistoryLinkText, { color: theme.colors.primary }]}>View Full Service Ledger</Text>
                      <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.rawInfoSection}>
                <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>Active Routines</Text>
                {assignedRoutines.length === 0 ? (
                  <View style={[styles.emptySparesContainer, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.emptySparesText, { color: theme.colors.textSecondary }]}>No routines assigned to this asset</Text>
                  </View>
                ) : (
                  <View style={styles.routinesList}>
                    {assignedRoutines.map(routine => (
                      <View key={routine.id} style={[styles.routineItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.routineInfo}>
                          <Text style={[styles.routineType, { color: theme.colors.text }]}>{routine.type} Routine</Text>
                          <Text style={[styles.routineDue, { color: theme.colors.textSecondary }]}>Next Due: {routine.next_due}</Text>
                        </View>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: routine.is_overdue ? (theme.dark ? '#450a0a' : '#FEF2F2') : (routine.is_future ? (theme.dark ? '#064e3b' : '#F0FDF4') : (theme.dark ? '#451a03' : '#FFFBEB')) }
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            { color: routine.is_overdue ? theme.colors.error : (routine.is_future ? theme.colors.success : theme.colors.warning) }
                          ]}>
                            {routine.is_overdue ? 'OVERDUE' : (routine.is_future ? 'Upcoming' : 'Due Today')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.rawInfoSection}>
                <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>Linked Spare Parts</Text>
                {linkedSpares.length === 0 ? (
                  <View style={[styles.emptySparesContainer, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.emptySparesText, { color: theme.colors.textSecondary }]}>No parts linked to this asset</Text>
                    <TouchableOpacity
                      style={styles.linkPartsInlineBtn}
                      onPress={() => {
                        if (equipmentId) {
                          setShowDetails(false);
                          router.push({
                            pathname: '/equipment-details',
                            params: { id: equipmentId }
                          });
                        }
                      }}
                    >
                      <Text style={[styles.linkPartsInlineText, { color: theme.colors.primary }]}>Link Spare Parts Now</Text>
                      <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.sparesGrid}>
                    {linkedSpares.map(spare => (
                      <View key={spare.id} style={[styles.spareCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <View style={styles.spareCardTop}>
                          <Text style={[styles.spareNameText, { color: theme.colors.text }]} numberOfLines={1}>{spare.name}</Text>
                          <View style={[
                            styles.miniStockBadge,
                            { backgroundColor: spare.available_quantity <= spare.minimum_quantity ? (theme.dark ? '#450a0a' : '#FEF2F2') : (theme.dark ? '#064e3b' : '#F0FDF4') }
                          ]}>
                            <Text style={[
                              styles.miniStockText,
                              { color: spare.available_quantity <= spare.minimum_quantity ? theme.colors.error : theme.colors.success }
                            ]}>
                              {spare.available_quantity} units
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.sparePartNo, { color: theme.colors.textSecondary }]}>{spare.part_number}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.rawInfoSection, { marginTop: 20 }]}>
                <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>Metadata Details</Text>
                <View style={styles.rawGrid}>
                  {scannedData && Object.entries(scannedData).map(([key, value]) => {
                    // Filter out internal fields if necessary
                    if (['id', 'name', 'equipment_id'].includes(key)) return null;
                    return (
                      <View key={key} style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                        <Text style={[styles.detailKey, { color: theme.colors.textSecondary }]}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                        </Text>
                        <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1}>{String(value)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={[styles.scanAgainButton, { backgroundColor: theme.colors.background }]}
                  onPress={resetScanner}
                >
                  <Ionicons name="refresh" size={18} color={theme.colors.textSecondary} />
                  <Text style={[styles.scanAgainText, { color: theme.colors.textSecondary }]}>Retry</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.historyActionButton, { backgroundColor: theme.dark ? '#1E3A8A' : theme.colors.primary }]}
                  onPress={() => {
                    setShowDetails(false);
                    router.push({
                      pathname: '/routine-history',
                      params: {
                        equipmentId: (scannedData?.id || scannedData?.equipment_id || equipmentId)?.toString(),
                        equipmentName: equipmentName || scannedData?.name
                      }
                    });
                  }}
                >
                  <Ionicons name="journal-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.historyActionText}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.defectActionBtn, { backgroundColor: theme.dark ? '#450a0a' : '#FEF2F2' }]}
                  onPress={() => setShowDefectModal(true)}
                >
                  <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  if (equipmentId) {
                    setShowDetails(false);
                    router.push({
                      pathname: '/equipment-details',
                      params: { id: equipmentId }
                    });
                  } else {
                    Alert.alert('Not Found', 'Could not locate this equipment in the database.');
                  }
                }}
              >
                <Text style={styles.primaryActionText}>View Complete Asset Profile</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Defect Reporting Modal */}
      <Modal visible={showDefectModal} transparent animationType="fade">
        <View style={styles.defectModalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.defectModalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.defectModalHeader}>
                <Text style={[styles.defectModalTitle, { color: theme.colors.text }]}>Report Defect</Text>
                <TouchableOpacity onPress={() => setShowDefectModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.defectModalSub, { color: theme.colors.textSecondary }]}>Identifying an issue for {equipmentName || 'this asset'}</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.defectLabel, { color: theme.colors.textSecondary }]}>Issue Title</Text>
                <TextInput
                  style={[styles.defectInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. Unusual noise from motor"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={defectForm.title}
                  onChangeText={t => setDefectForm(f => ({ ...f, title: t }))}
                />

                <Text style={[styles.defectLabel, { color: theme.colors.textSecondary }]}>Priority</Text>
                <View style={styles.priorityRow}>
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

                <Text style={[styles.defectLabel, { color: theme.colors.textSecondary }]}>Reported By *</Text>
                <TextInput
                  style={[styles.defectInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={defectForm.reportedBy}
                  onChangeText={t => setDefectForm(f => ({ ...f, reportedBy: t }))}
                />

                <Text style={[styles.defectLabel, { color: theme.colors.textSecondary }]}>Detailed Description</Text>
                <TextInput
                  style={[styles.defectInput, { height: 100, textAlignVertical: 'top', backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
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
    </View>
  );
}const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  messageText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  // Overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  torchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scanner Frame
  scannerFrameContainer: {
    alignItems: 'center',
  },
  scannerFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 12,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 12,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Bottom Info
  bottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
    gap: 8,
  },
  bottomInfoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '94%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeModalBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  detailsContainer: {
    maxHeight: 450,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#2563EB',
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  summaryId: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  historyHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  historyValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
  },
  lastLogSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  miniTasksContainer: {
    marginBottom: 16,
  },
  tasksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  miniTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    minWidth: '48%',
  },
  miniTaskText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  moreTasksText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  miniRemarksContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  miniRemarksText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  fullHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  fullHistoryLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  rawInfoSection: {
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  rawGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailKey: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '60%',
  },
  modalFooter: {
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  emptySparesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
  },
  emptySparesText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  linkPartsInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  linkPartsInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  sparesGrid: {
    gap: 10,
  },
  spareCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  spareCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  spareNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  sparePartNo: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  miniStockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStockText: {
    fontSize: 10,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanAgainButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  scanAgainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  historyActionButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
  },
  historyActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  defectActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Defect Modal
  defectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  defectModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  defectModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  defectModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  defectModalSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  defectLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defectInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    marginBottom: 20,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  priorityChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  priorityChipTextActive: {
    color: '#FFFFFF',
  },
  defectSubmitBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  defectSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Active Routines Styles
  routinesList: {
    gap: 12,
  },
  routineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  routineInfo: {
    flex: 1,
  },
  routineType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  routineDue: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});