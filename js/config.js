// ============================================
// Configuration & Constants
// ============================================

const BASE_PATH = '/kekarav-s132';
const API_URL = BASE_PATH + '/api/data';

const DEFAULT_USERS = [
    { id: 0, name: 'Admin', role: 'Admin' },
    { id: 1, name: 'John Developer', role: 'Developer' },
    { id: 2, name: 'Jane QA', role: 'QA' },
    { id: 3, name: 'Bob Manager', role: 'Manager' },
    { id: 4, name: 'Alice Lead', role: 'Lead' }
];

const STATES = ['New', 'InProgress', 'Ready', 'Approved', 'Declined', 'Done', 'RecycleBin'];

const STATE_TRANSITIONS = {
    'New': ['InProgress', 'RecycleBin'],
    'InProgress': ['Ready', 'New', 'RecycleBin'],
    'Ready': ['Approved', 'Declined', 'InProgress', 'RecycleBin'],
    'Approved': ['InProgress', 'Done', 'RecycleBin'],
    'Declined': ['Done', 'InProgress', 'RecycleBin'],
    'Done': ['RecycleBin'],
    'RecycleBin': []
};

const STATE_COLORS = {
    'New': 'secondary',
    'InProgress': 'primary',
    'Ready': 'info',
    'Approved': 'success',
    'Declined': 'danger',
    'Done': 'teal',
    'RecycleBin': 'dark'
};

