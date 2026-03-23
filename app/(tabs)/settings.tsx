import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import { useTheme } from '../../context/ThemeContext';
import { getDB } from '../../database';

const DEFAULT_SCHEDULES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];

interface Equipment {
  id: number;
  equipment_id: string;
  name: string;
}

interface ChecklistItem {
  id: number;
  schedule_id: number;
  routine_no: string;
  task_description: string;
  schedule_type?: string;
}

export default function Settings() {
  const router = useRouter();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'Checklists' | 'Categories' | 'Preferences'>('Checklists');
  // Category State
  const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
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
  const [newRoutineNo, setNewRoutineNo] = useState('');
  const [editTaskData, setEditTaskData] = useState<{ id: number, text: string, routine_no: string } | null>(null);
  const [showCustomRoutineModal, setShowCustomRoutineModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [availableSchedules, setAvailableSchedules] = useState<string[]>(DEFAULT_SCHEDULES);
  const [unitSystem, setUnitSystem] = useState<'Metric' | 'Imperial'>('Metric');
  const [language, setLanguage] = useState('English');
  const params = useLocalSearchParams();
  
  // Model state
  const [modelAvailable, setModelAvailable] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  useEffect(() => {
    if (params.tab === 'Categories') {
      setActiveTab('Categories');
      if (params.addCat === 'true') {
        setShowAddCatModal(true);
      }
    }
  }, [params.tab, params.addCat]);


  useFocusEffect(
    useCallback(() => {
      loadEquipment();
      loadCategories();
      checkModelAvailability();
    }, [])
  );

  const checkModelAvailability = async () => {
    try {
      const targetUri = (FileSystem as any).documentDirectory + 'ai_model.gguf';
      const info = await FileSystem.getInfoAsync(targetUri);
      setModelAvailable(info.exists);
    } catch (e) { console.error(e); }
  };

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

      // Extract unique schedule types for this equipment
      const uniqueTypes = Array.from(new Set([
        ...DEFAULT_SCHEDULES,
        ...dbItems.map(i => i.schedule_type).filter(Boolean) as string[]
      ])).sort();
      setAvailableSchedules(uniqueTypes);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCategories = () => {
    const db = getDB();
    try {
      const dbCats = db.getAllSync<{ id: number, name: string }>('SELECT * FROM Spare_Categories ORDER BY name');
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
      let scheduleRec = db.getFirstSync<{ id: number }>(
        'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
        [selectedEquipment, selectedSchedule]
      );

      // Create schedule wrapper exactly on first task addition
      if (!scheduleRec) {
        db.runSync(
          'INSERT INTO Maintenance_Schedule (equipment_id, schedule_type) VALUES (?, ?)',
          [selectedEquipment, selectedSchedule]
        );
        scheduleRec = db.getFirstSync<{ id: number }>(
          'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
          [selectedEquipment, selectedSchedule]
        );
      }

      if (scheduleRec) {
        db.runSync(
          'INSERT INTO Checklist_Items (schedule_id, routine_no, task_description) VALUES (?, ?, ?)',
          [scheduleRec.id, newRoutineNo, newTask]
        );
        setNewTask('');
        setNewRoutineNo('');
        setShowAddModal(false);
        loadAllChecklists(selectedEquipment);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const addCustomRoutine = () => {
    if (!newRoutineName.trim() || !selectedEquipment) return;
    const db = getDB();
    try {
      const existing = db.getFirstSync(
        'SELECT id FROM Maintenance_Schedule WHERE equipment_id = ? AND schedule_type = ?',
        [selectedEquipment, newRoutineName.trim()]
      );

      if (existing) {
        Alert.alert('Exists', 'This routine already exists for this equipment.');
        return;
      }

      db.runSync(
        'INSERT INTO Maintenance_Schedule (equipment_id, schedule_type) VALUES (?, ?)',
        [selectedEquipment, newRoutineName.trim()]
      );

      setAvailableSchedules(prev => Array.from(new Set([...prev, newRoutineName.trim()])).sort());
      setNewRoutineName('');
      setShowCustomRoutineModal(false);
      Alert.alert('Success', 'Custom routine created.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to create routine');
    }
  };

  const generateQRCodePDF = async () => {
    const db = getDB();
    try {
      const equipment = db.getAllSync<{ equipment_id: string, name: string }>('SELECT equipment_id, name FROM Equipment ORDER BY equipment_id');
      
      if (equipment.length === 0) {
        Alert.alert('No Data', 'There is no equipment to export.');
        return;
      }

      // Simple QR Code library (embedded)
      const qrCodeLib = `
        var QRCode=(function(){function h(b,a){this.typeNumber=b;this.errorCorrectLevel=a;this.modules=null;this.moduleCount=0;this.dataCache=null;this.dataList=[]}h.prototype={addData:function(b){this.dataList.push(new l(b));this.dataCache=null},isDark:function(b,a){if(0>b||this.moduleCount<=b||0>a||this.moduleCount<=a)throw Error(b+","+a);return this.modules[b][a]},getModuleCount:function(){return this.moduleCount},make:function(){this.makeImpl(!1,this.getBestMaskPattern())},makeImpl:function(b,a){this.moduleCount=4*this.typeNumber+17;this.modules=Array(this.moduleCount);for(var c=0;c<this.moduleCount;c++){this.modules[c]=Array(this.moduleCount);for(var d=0;d<this.moduleCount;d++)this.modules[c][d]=null}this.setupPositionProbePattern(0,0);this.setupPositionProbePattern(this.moduleCount-7,0);this.setupPositionProbePattern(0,this.moduleCount-7);this.setupPositionAdjustPattern();this.setupTimingPattern();this.setupTypeInfo(b,a);7<=this.typeNumber&&this.setupTypeNumber(b);null==this.dataCache&&(this.dataCache=h.createData(this.typeNumber,this.errorCorrectLevel,this.dataList));this.mapData(this.dataCache,a)},setupPositionProbePattern:function(b,a){for(var c=-1;7>=c;c++)if(!(-1>=b+c||this.moduleCount<=b+c))for(var d=-1;7>=d;d++)-1>=a+d||this.moduleCount<=a+d?void 0:0<=c&&6>=c&&(0==d||6==d)||0<=d&&6>=d&&(0==c||6==c)||2<=c&&4>=c&&2<=d&&4>=d?this.modules[b+c][a+d]=!0:this.modules[b+c][a+d]=!1},getBestMaskPattern:function(){for(var b=0,a=0,c=0;8>c;c++){this.makeImpl(!0,c);var d=m.getLostPoint(this);if(0==c||b>d)b=d,a=c}return a},setupTimingPattern:function(){for(var b=8;b<this.moduleCount-8;b++)null==this.modules[b][6]&&(this.modules[b][6]=0==b%2);for(var a=8;a<this.moduleCount-8;a++)null==this.modules[6][a]&&(this.modules[6][a]=0==a%2)},setupPositionAdjustPattern:function(){for(var b=m.getAlignmentPattern(this.typeNumber),a=0;a<b.length;a++)for(var c=0;c<b.length;c++){var d=b[a],e=b[c];if(null==this.modules[d][e])for(var f=-2;2>=f;f++)for(var g=-2;2>=g;g++)this.modules[d+f][e+g]=Math.abs(f)<=1&&Math.abs(g)<=1&&(0==f||0==g)?!0:!1}},setupTypeNumber:function(b){for(var a=m.getBCHTypeNumber(this.typeNumber),c=0;18>c;c++){var d=!b&&1==(a>>c&1);this.modules[Math.floor(c/3)][c%3+this.moduleCount-8-3]=d}for(c=0;18>c;c++)d=!b&&1==(a>>c&1),this.modules[c%3+this.moduleCount-8-3][Math.floor(c/3)]=d},setupTypeInfo:function(b,a){for(var c=this.errorCorrectLevel<<3|a,d=m.getBCHTypeInfo(c),e=0;15>e;e++){var f=!b&&1==(d>>e&1);8>e?this.modules[e][8]=f:9>e?this.modules[8][7]=f:this.modules[this.moduleCount-15+e][8]=f}for(e=0;15>e;e++)f=!b&&1==(d>>e&1),8>e?this.modules[8][this.moduleCount-e-1]=f:15>e?this.modules[8][14-e]=f:this.modules[8][15-e]=f;this.modules[this.moduleCount-8][8]=!b},mapData:function(b,a){for(var c=-1,d=this.moduleCount-1,e=7,f=0,g=this.moduleCount-1;0<g;g-=2)for(6==g&&g--;;){for(var h=0;2>h;h++)if(null==this.modules[d][g-h]){var k=!1;f<b.length&&(k=1==(b[f]>>e&1));m.getMask(a,d,g-h)&&(k=!k);this.modules[d][g-h]=k;e--;-1==e&&(f++,e=7)}d+=c;if(0>d||this.moduleCount<=d){d-=c;c=-c;break}}}};h.createData=function(b,a,c){for(var d=n.getRSBlocks(b,a),e=new p,f=0;f<c.length;f++){var g=c[f];e.put(g.mode,4);e.put(g.getLength(),m.getLengthInBits(g.mode,b));g.write(e)}for(f=b=0;f<d.length;f++)b+=d[f].dataCount;if(e.getLengthInBits()>8*b)throw Error("code length overflow. ("+e.getLengthInBits()+">"+8*b+")");e.getLengthInBits()+4<=8*b&&e.put(0,4);for(;0!=e.getLengthInBits()%8;)e.putBit(!1);for(;!(e.getLengthInBits()>=8*b);){e.put(236,8);if(e.getLengthInBits()>=8*b)break;e.put(17,8)}return h.createBytes(e,d)};h.createBytes=function(b,a){for(var c=0,d=0,e=0,f=Array(a.length),g=Array(a.length),h=0;h<a.length;h++){var k=a[h].dataCount,l=a[h].totalCount-k;d=Math.max(d,k);e=Math.max(e,l);f[h]=Array(k);for(var n=0;n<f[h].length;n++)f[h][n]=255&b.buffer[n+c];c+=k;var p=m.getErrorCorrectPolynomial(l),q=(new r(f[h],p.getLength()-1)).mod(p);g[h]=Array(p.getLength()-1);for(n=0;n<g[h].length;n++){var t=n+q.getLength()-g[h].length;g[h][n]=0<=t?q.get(t):0}}for(n=h=0;h<a.length;h++)n+=a[h].totalCount;c=Array(n);for(n=k=0;d>k;k++)for(h=0;h<a.length;h++)k<f[h].length&&(c[n++]=f[h][k]);for(k=0;e>k;k++)for(h=0;h<a.length;h++)k<g[h].length&&(c[n++]=g[h][k]);return c};for(var l=function(b){this.mode=4;this.data=b},m={PATTERN_POSITION_TABLE:[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],G15:1335,G18:7973,G15_MASK:21522,getBCHTypeInfo:function(b){for(var a=b<<10;0<=m.getBCHDigit(a)-m.getBCHDigit(m.G15);)a^=m.G15<<m.getBCHDigit(a)-m.getBCHDigit(m.G15);return(b<<10|a)^m.G15_MASK},getBCHTypeNumber:function(b){for(var a=b<<12;0<=m.getBCHDigit(a)-m.getBCHDigit(m.G18);)a^=m.G18<<m.getBCHDigit(a)-m.getBCHDigit(m.G18);return b<<12|a},getBCHDigit:function(b){for(var a=0;0!=b;)a++,b>>>=1;return a},getAlignmentPattern:function(b){return m.PATTERN_POSITION_TABLE[b-1]},getMask:function(b,a,c){switch(b){case 0:return 0==(a+c)%2;case 1:return 0==a%2;case 2:return 0==c%3;case 3:return 0==(a+c)%3;case 4:return 0==(Math.floor(a/2)+Math.floor(c/3))%2;case 5:return 0==a*c%2+a*c%3;case 6:return 0==(a*c%2+a*c%3)%2;case 7:return 0==(a*c%3+(a+c)%2)%2}throw Error("bad maskPattern:"+b)},getErrorCorrectPolynomial:function(b){for(var a=new r([1],0),c=0;c<b;c++)a=a.multiply(new r([1,s.gexp(c)],0));return a},getLengthInBits:function(b,a){if(1<=a&&10>a)switch(b){case 1:return 10;case 2:return 9;case 4:return 8;case 8:return 8}else if(27>a)switch(b){case 1:return 12;case 2:return 11;case 4:return 16;case 8:return 10}else if(41>a)switch(b){case 1:return 14;case 2:return 13;case 4:return 16;case 8:return 12}else throw Error("type:"+a);},getLostPoint:function(b){for(var a=b.getModuleCount(),c=0,d=0;d<a;d++)for(var e=0;e<a;e++){for(var f=0,g=b.isDark(d,e),h=-1;1>=h;h++)if(!(0>d+h||a<=d+h))for(var k=-1;1>=k;k++)0>e+k||a<=e+k||0==h&&0==k||g==b.isDark(d+h,e+k)&&f++;5<f&&(c+=3+f-5)}for(d=0;d<a-1;d++)for(e=0;e<a-1;e++)f=0,b.isDark(d,e)&&f++,b.isDark(d+1,e)&&f++,b.isDark(d,e+1)&&f++,b.isDark(d+1,e+1)&&f++,(0==f||4==f)&&(c+=3);for(d=0;d<a;d++)for(e=0;e<a-6;e++)b.isDark(d,e)&&!b.isDark(d,e+1)&&b.isDark(d,e+2)&&b.isDark(d,e+3)&&b.isDark(d,e+4)&&!b.isDark(d,e+5)&&b.isDark(d,e+6)&&(c+=40);for(e=0;e<a;e++)for(d=0;d<a-6;d++)b.isDark(d,e)&&!b.isDark(d+1,e)&&b.isDark(d+2,e)&&b.isDark(d+3,e)&&b.isDark(d+4,e)&&!b.isDark(d+5,e)&&b.isDark(d+6,e)&&(c+=40);for(e=f=0;e<a;e++)for(d=0;d<a;d++)b.isDark(d,e)&&f++;b=Math.abs(100*f/a/a-50)/5;return c+10*b}},s={glog:function(b){if(1>b)throw Error("glog("+b+")");return m[b]},gexp:function(b){for(;0>b;)b+=255;for(;255<=b;)b-=255;return a[b]},EXP_TABLE:Array(256),LOG_TABLE:Array(256)},t=0;8>t;t++)s.EXP_TABLE[t]=1<<t;for(t=8;256>t;t++)s.EXP_TABLE[t]=s.EXP_TABLE[t-4]^s.EXP_TABLE[t-5]^s.EXP_TABLE[t-6]^s.EXP_TABLE[t-8];for(t=0;255>t;t++)s.LOG_TABLE[s.EXP_TABLE[t]]=t;var a=s.EXP_TABLE,m=s.LOG_TABLE;r.prototype={get:function(b){return this.num[b]},getLength:function(){return this.num.length},multiply:function(b){for(var a=Array(this.getLength()+b.getLength()-1),c=0;c<this.getLength();c++)for(var d=0;d<b.getLength();d++)a[c+d]^=s.gexp(s.glog(this.get(c))+s.glog(b.get(d)));return new r(a,0)},mod:function(b){if(0>this.getLength()-b.getLength())return this;for(var a=s.glog(this.get(0))-s.glog(b.get(0)),c=Array(this.getLength()),d=0;d<this.getLength();d++)c[d]=this.get(d);for(d=0;d<b.getLength();d++)c[d]^=s.gexp(s.glog(b.get(d))+a);return(new r(c,0)).mod(b)}};function r(b,a){if(void 0==b.length)throw Error(b.length+"/"+a);for(var c=0;c<b.length&&0==b[c];)c++;this.num=Array(b.length-c+a);for(var d=0;d<b.length-c;d++)this.num[d]=b[d+c]}var n={RS_BLOCK_TABLE:[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[1,172,136],[4,43,27],[4,43,19],[4,43,15],[2,86,68],[4,43,27],[4,43,18,1,44,19],[6,43,16],[2,108,86],[4,27,13,2,28,14],[4,27,10,4,28,11],[6,27,8,2,28,9],[2,130,98],[4,65,45],[8,33,23],[4,33,15,4,34,16],[2,151,121],[4,76,53],[2,38,15,8,39,16],[4,38,11,8,39,12],[2,177,146],[4,89,60],[4,44,22,4,45,23],[4,44,14,10,45,15]],getRSBlocks:function(b,a){var c=n.getRsBlockTable(b,a);if(void 0==c)throw Error("bad rs block @ typeNumber:"+b+"/errorCorrectLevel:"+a);for(var d=c.length/3,e=[],f=0;d>f;f++)for(var g=c[3*f],h=c[3*f+1],k=c[3*f+2],l=0;g>l;l++)e.push(new q(h,k));return e},getRsBlockTable:function(b,a){switch(a){case 1:return n.RS_BLOCK_TABLE[4*(b-1)+0];case 0:return n.RS_BLOCK_TABLE[4*(b-1)+1];case 3:return n.RS_BLOCK_TABLE[4*(b-1)+2];case 2:return n.RS_BLOCK_TABLE[4*(b-1)+3]}}},q=function(b,a){this.totalCount=b;this.dataCount=a};p.prototype={get:function(b){return 1==(this.buffer[Math.floor(b/8)]>>7-b%8&1)},put:function(b,a){for(var c=0;a>c;c++)this.putBit(1==(b>>a-c-1&1))},getLengthInBits:function(){return this.length},putBit:function(b){var a=Math.floor(this.length/8);this.buffer.length<=a&&this.buffer.push(0);b&&(this.buffer[a]|=128>>this.length%8);this.length++}};function p(){this.buffer=[];this.length=0}l.prototype={getLength:function(){return this.data.length},write:function(b){for(var a=0;a<this.data.length;a++)b.put(this.data.charCodeAt(a),8)}};h.createImgTag=function(b,a){b=b||2;a=a||0;var c=(new h(4,1));c.addData("test");c.make();var d=c.getModuleCount()*b+2*a,e=document.createElement("canvas");e.width=d;e.height=d;d=e.getContext("2d");for(var f=0;f<c.getModuleCount();f++)for(var g=0;g<c.getModuleCount();g++){d.fillStyle=c.isDark(f,g)?"#000000":"#ffffff";d.fillRect(g*b+a,f*b+a,b,b)}return e.toDataURL("image/png")};return h})();
      `;

      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              @page { margin: 10mm; }
              body { font-family: 'Helvetica', sans-serif; padding: 0; margin: 0; }
              .container { display: flex; flex-wrap: wrap; justify-content: flex-start; }
              .label { 
                width: 45mm; 
                height: 30mm; 
                border: 0.1mm solid #eee; 
                padding: 2mm; 
                margin: 2mm; 
                display: flex; 
                flex-direction: row; 
                align-items: center;
                background-color: white;
              }
              .qr-container { width: 22mm; height: 22mm; margin-right: 2mm; }
              .info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
              .id { font-weight: bold; font-size: 8pt; color: #333; margin-bottom: 2pt; word-break: break-all; }
              .name { font-size: 6pt; color: #666; line-height: 8pt; overflow: hidden; height: 16pt; }
              .brand { font-size: 5pt; color: #2563EB; font-weight: bold; margin-top: 4pt; }
              h1 { font-size: 14pt; margin-left: 4mm; color: #2563EB; border-bottom: 1px solid #eee; padding-bottom: 5mm; }
            </style>
          </head>
          <body>
            <h1>SUJATA Equipment QR Codes</h1>
            <div class="container">
              ${equipment.map(e => `
                <div class="label">
                  <div class="qr-container"><img id="img-${e.equipment_id}" style="width:100%; height:100%;" /></div>
                  <div class="info">
                    <div class="id">${e.equipment_id}</div>
                    <div class="name">${e.name}</div>
                    <div class="brand">NAVY MAINT</div>
                  </div>
                </div>
              `).join('')}
            </div>
            <script>
              ${qrCodeLib}
              
              function generate() {
                var data = ${JSON.stringify(equipment)};
                data.forEach(function(e) {
                  try {
                    var type = 4;
                    var qrcode = new QRCode(type, 1);
                    qrcode.addData(e.equipment_id);
                    qrcode.make();
                    
                    var size = 2;
                    var canvas = document.createElement("canvas");
                    var moduleCount = qrcode.getModuleCount();
                    var canvasSize = moduleCount * size;
                    canvas.width = canvasSize;
                    canvas.height = canvasSize;
                    var ctx = canvas.getContext("2d");
                    
                    for (var row = 0; row < moduleCount; row++) {
                      for (var col = 0; col < moduleCount; col++) {
                        ctx.fillStyle = qrcode.isDark(row, col) ? "#000000" : "#ffffff";
                        ctx.fillRect(col * size, row * size, size, size);
                      }
                    }
                    
                    var img = document.getElementById("img-" + e.equipment_id);
                    if (img) img.src = canvas.toDataURL("image/png");
                  } catch (err) {
                    console.error("QR generation failed for " + e.equipment_id, err);
                  }
                });
              }
              
              generate();
            </script>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to generate QR export.');
    }
  };

  const exportDatabase = async () => {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/Sujata.db`;
      const exists = await FileSystem.getInfoAsync(dbPath);
      
      if (!exists.exists) {
        Alert.alert('Error', 'Database file not found.');
        return;
      }

      // Create a temporary copy with a better filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupUri = `${FileSystem.cacheDirectory}SUJATA_Backup_${timestamp}.db`;
      await FileSystem.copyAsync({ from: dbPath, to: backupUri });

      // Share/Save the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupUri, {
          dialogTitle: 'Save Database Backup',
          mimeType: 'application/x-sqlite3',
          UTI: 'public.database'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to export database.');
    }
  };

  const updateChecklistItem = () => {
    if (!editTaskData || !editTaskData.text.trim()) return;
    const db = getDB();
    try {
      db.runSync(
        'UPDATE Checklist_Items SET task_description = ?, routine_no = ? WHERE id = ?',
        [editTaskData.text, editTaskData.routine_no, editTaskData.id]
      );
      setShowEditModal(false);
      setEditTaskData(null);
      if (selectedEquipment) loadAllChecklists(selectedEquipment);
    } catch (e) { Alert.alert('Error', 'Failed to update item'); }
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

  const handleUploadModel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const asset = result.assets[0];
      const sourceUri = asset.uri;
      
      setModelLoading(true);
      const targetUri = (FileSystem as any).documentDirectory + 'ai_model.gguf';
      
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri);
      }
      
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetUri
      });
      
      Alert.alert('Success', 'AI Troubleshooting Model is now loaded and available for offline chat!');
      checkModelAvailability();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to load model.');
    } finally {
      setModelLoading(false);
    }
  };


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>SUJATA Settings</Text>
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
            style={styles.tab}
            onPress={() => router.push('/vessels')}
          >
            <Text style={styles.tabText}>
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
                {availableSchedules.map(schedule => {
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
                            <View style={styles.taskNum}><Text style={styles.taskNumText}>{item.routine_no || (index + 1)}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.taskDesc}>{item.task_description}</Text>
                            </View>
                             <View style={styles.taskActions}>
                              <TouchableOpacity style={{ marginRight: 12 }} onPress={() => {
                                setEditTaskData({
                                  id: item.id,
                                  text: item.task_description,
                                  routine_no: item.routine_no || ''
                                });
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

                <TouchableOpacity
                  style={[styles.actionButton, { marginTop: 24, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 }]}
                  onPress={() => setShowCustomRoutineModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                  <Text style={[styles.actionText, { color: theme.colors.primary }]}>Add Custom Routine Type</Text>
                </TouchableOpacity>

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

              {/* AI Model Loader Placeholder */}
              <View style={[styles.compactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginTop: 12 }]}>
                <View style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 10, paddingVertical: 10 }]}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>AI Troubleshooting Model</Text>
                    <Text style={[styles.rowSubtitle, { color: modelAvailable ? theme.colors.success : theme.colors.error, fontWeight: '500' }]}>
                      {modelAvailable ? 'Available' : 'Missing'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, opacity: modelLoading ? 0.7 : 1 }} 
                    onPress={handleUploadModel}
                    disabled={modelLoading}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                      {modelLoading ? 'Loading...' : (modelAvailable ? 'Reload Model' : 'Load Model')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

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

                <TouchableOpacity 
                  style={[styles.actionRow, { paddingVertical: 10 }]}
                  onPress={generateQRCodePDF}
                >
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Export All QR Codes</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>Download all equipment labels as PDF</Text>
                  </View>
                  <Ionicons name="qr-code-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionRow, { paddingVertical: 10 }]}
                  onPress={exportDatabase}
                >
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
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Task</Text>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Select frequency and enter the description</Text>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { marginBottom: 16 }]}>
                  {availableSchedules.map(schedule => (
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
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text, marginBottom: 12 }]}
                  placeholder="Routine No (e.g. R1)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newRoutineNo}
                  onChangeText={setNewRoutineNo}
                />

                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Task Description (e.g. Check Oil)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newTask}
                  onChangeText={setNewTask}
                />

                 <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => {
                    setShowAddModal(false);
                    setNewTask('');
                    setNewRoutineNo('');
                  }}>
                    <Text style={styles.modalBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSubmit} onPress={addChecklistItem}>
                    <Text style={styles.modalBtnSubmitText}>Add Task</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Task Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Task</Text>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Update the checklist item description</Text>
               <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text, marginBottom: 12 }]}
                  placeholder="Routine No"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={editTaskData?.routine_no || ''}
                  onChangeText={text => setEditTaskData(prev => prev ? { ...prev, routine_no: text } : null)}
                />

                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Task Description"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={editTaskData?.text || ''}
                  onChangeText={text => setEditTaskData(prev => prev ? { ...prev, text } : null)}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowEditModal(false); setEditTaskData(null); }}>
                    <Text style={styles.modalBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSubmit} onPress={updateChecklistItem}>
                    <Text style={styles.modalBtnSubmitText}>Update Task</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={showAddCatModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Category</Text>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Enter the name for the new spare part category</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. Fluids, Fasteners"
                  placeholderTextColor={theme.colors.textSecondary}
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add Custom Routine Modal */}
      <Modal visible={showCustomRoutineModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Routine Type</Text>
              <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Create a custom frequency (e.g. "Occasional", "4 Month")</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. 4 Month Routine"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newRoutineName}
                  onChangeText={setNewRoutineName}
                  autoFocus
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowCustomRoutineModal(false); setNewRoutineName(''); }}>
                    <Text style={styles.modalBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSubmit} onPress={addCustomRoutine}>
                    <Text style={styles.modalBtnSubmitText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Equipment Select Modal */}
      <Modal visible={showEquipModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%', padding: 0 }]}>
            <View style={styles.equipModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={styles.modalTitle}>Select Equipment</Text>
                <TouchableOpacity
                  onPress={loadEquipment}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
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
                    <Text style={[styles.equipModalName, selectedEquipment === eq.id && { color: '#2563EB' }]}>{eq.name}</Text>
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
