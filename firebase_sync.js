/**
 * Módulo de Sincronización en la Nube con Firebase Firestore
 * Permite sincronizar las órdenes de trabajo entre 2 o 3 ordenadores en tiempo real de forma gratuita.
 */

const STORAGE_KEY_CONFIG = 'imprenta_firebase_config';
const COLLECTION_NAME = 'ordenes_trabajo';

let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;
let unsubscribeSnapshot = null;
let isSyncing = false;
let currentUser = null;
let authListeners = [];

// Estado actual del servicio de nube
const CloudStatus = {
  isConfigured: false,
  isConnected: false,
  lastSyncTime: null,
  statusMessage: 'Modo Local',
  currentUser: null,
  listeners: []
};

function notifyStatusChange() {
  CloudStatus.currentUser = currentUser;
  CloudStatus.listeners.forEach(fn => fn(CloudStatus));
}

function onCloudStatusChange(fn) {
  CloudStatus.listeners.push(fn);
  fn(CloudStatus);
}

function onAuthStateChange(fn) {
  authListeners.push(fn);
  fn(currentUser);
}

function notifyAuthChange(user) {
  currentUser = user;
  CloudStatus.currentUser = user;
  authListeners.forEach(fn => fn(user));
  notifyStatusChange();
}

/**
 * Iniciar sesión con Correo y Contraseña
 */
async function iniciarSesion(email, password) {
  if (!firebaseAuth) throw new Error('Firebase Auth no está inicializado.');
  try {
    const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
    notifyAuthChange(cred.user);
    return { ok: true, user: cred.user };
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    throw err;
  }
}

/**
 * Registrar un nuevo usuario (primera vez)
 */
async function registrarUsuario(email, password) {
  if (!firebaseAuth) throw new Error('Firebase Auth no está inicializado.');
  try {
    const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    notifyAuthChange(cred.user);
    return { ok: true, user: cred.user };
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    throw err;
  }
}

/**
 * Cerrar sesión
 */
async function cerrarSesion() {
  if (!firebaseAuth) return;
  try {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    await firebaseAuth.signOut();
    notifyAuthChange(null);
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    throw err;
  }
}

function obtenerUsuarioActual() {
  return currentUser;
}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBr1Ep_O_TtRuk92TTcbdgCdPcwT8xi9dU",
  authDomain: "ordenes-imprenta.firebaseapp.com",
  projectId: "ordenes-imprenta",
  storageBucket: "ordenes-imprenta.firebasestorage.app",
  messagingSenderId: "350323341526",
  appId: "1:350323341526:web:adb640b59f89a234a03177"
};

/**
 * Obtiene la configuración guardada de Firebase
 */
function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return JSON.parse(raw);
    return DEFAULT_FIREBASE_CONFIG;
  } catch (e) {
    console.error('Error al leer configuración de Firebase:', e);
    return DEFAULT_FIREBASE_CONFIG;
  }
}

/**
 * Guarda la configuración de Firebase
 */
function saveFirebaseConfig(config) {
  if (!config) {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  } else {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  }
}

/**
 * Inicializa Firebase con la configuración proporcionada o almacenada
 */
function initFirebase(config = null) {
  const cfg = config || getStoredFirebaseConfig();
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    CloudStatus.isConfigured = false;
    CloudStatus.isConnected = false;
    CloudStatus.statusMessage = 'Modo Local (Sin Nube)';
    notifyStatusChange();
    return false;
  }

  try {
    // Si ya había una instancia previa
    if (firebaseApp) {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      try { firebase.app().delete(); } catch(e){}
    }

    firebaseApp = firebase.initializeApp(cfg);
    firestoreDb = firebase.firestore();

    // Inicializar Auth
    if (firebase.auth) {
      firebaseAuth = firebase.auth();
      // Persistencia local para recordar sesión
      try {
        firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch(e){}

      // Listener de estado de autenticación
      firebaseAuth.onAuthStateChanged((user) => {
        notifyAuthChange(user);
      });
    }

    // Habilitar persistencia offline si está soportada
    try {
      firestoreDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
        console.warn('Persistencia offline de Firestore:', err.code);
      });
    } catch(e){}

    CloudStatus.isConfigured = true;
    CloudStatus.isConnected = false;
    CloudStatus.statusMessage = 'Requiere Iniciar Sesión';
    notifyStatusChange();
    console.log('Firebase Firestore inicializado correctamente con proyecto:', cfg.projectId);
    return true;
  } catch (err) {
    console.error('Error al inicializar Firebase:', err);
    CloudStatus.isConfigured = true;
    CloudStatus.isConnected = false;
    CloudStatus.statusMessage = 'Error de Conexión Nube';
    notifyStatusChange();
    return false;
  }
}

/**
 * Escucha cambios en tiempo real desde Firestore
 */
function suscribirCambiosNube(onOrdersUpdated) {
  if (!firestoreDb) return;
  if (!currentUser) {
    console.log('Sincronización en espera: Se requiere inicio de sesión para acceder a la base de datos protegida.');
    return;
  }
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  try {
    unsubscribeSnapshot = firestoreDb.collection(COLLECTION_NAME).onSnapshot((snapshot) => {
      CloudStatus.isConnected = true;
      CloudStatus.lastSyncTime = new Date();
      CloudStatus.statusMessage = 'Nube Sincronizada';
      notifyStatusChange();

      const cloudOrders = [];
      snapshot.forEach(doc => {
        cloudOrders.push({ id: doc.id, ...doc.data() });
      });

      console.log(`Recibidas ${cloudOrders.length} órdenes desde la Nube.`);
      if (typeof onOrdersUpdated === 'function') {
        onOrdersUpdated(cloudOrders);
      }
    }, (error) => {
      console.error('Error en listener de Firestore:', error);
      CloudStatus.isConnected = false;
      CloudStatus.statusMessage = 'Error al sincronizar con Nube';
      notifyStatusChange();
    });
  } catch (err) {
    console.error('Excepción al suscribir a Firestore:', err);
  }
}

/**
 * Guarda o actualiza una orden en la nube Firestore
 */
async function guardarOrdenEnNube(orden) {
  if (!firestoreDb || !CloudStatus.isConfigured) return false;
  try {
    const ordenId = String(orden.id);
    const dataToSave = { ...orden };
    delete dataToSave.id; // el ID es el doc ID
    dataToSave.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    await firestoreDb.collection(COLLECTION_NAME).doc(ordenId).set(dataToSave, { merge: true });
    CloudStatus.lastSyncTime = new Date();
    notifyStatusChange();
    return true;
  } catch (err) {
    console.error('Error al guardar en Firestore:', err);
    return false;
  }
}

/**
 * Elimina una orden de la nube Firestore
 */
async function eliminarOrdenDeNube(ordenId) {
  if (!firestoreDb || !CloudStatus.isConfigured) return false;
  try {
    await firestoreDb.collection(COLLECTION_NAME).doc(String(ordenId)).delete();
    CloudStatus.lastSyncTime = new Date();
    notifyStatusChange();
    return true;
  } catch (err) {
    console.error('Error al eliminar de Firestore:', err);
    return false;
  }
}

/**
 * Sube un lote de órdenes locales a la nube (para migración inicial)
 */
async function subirTodasLasOrdenesANube(ordenesLocales) {
  if (!firestoreDb || !CloudStatus.isConfigured) {
    throw new Error('La nube no está configurada.');
  }

  const batch = firestoreDb.batch();
  for (const orden of ordenesLocales) {
    const docRef = firestoreDb.collection(COLLECTION_NAME).doc(String(orden.id));
    const data = { ...orden };
    delete data.id;
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    batch.set(docRef, data, { merge: true });
  }

  await batch.commit();
  CloudStatus.lastSyncTime = new Date();
  notifyStatusChange();
  return true;
}

/**
 * Prueba la conexión con un objeto de configuración
 */
async function testFirebaseConnection(config) {
  try {
    // Si ya existe app de test temporal la eliminamos
    let testApp;
    try {
      testApp = firebase.initializeApp(config, 'test-connection-' + Date.now());
    } catch(e) {
      testApp = firebase.app('test-connection-' + Date.now());
    }
    const testDb = testApp.firestore();
    // Intenta leer la colección
    await testDb.collection(COLLECTION_NAME).limit(1).get();
    await testApp.delete();
    return { ok: true, message: '¡Conexión establecida con éxito!' };
  } catch (err) {
    console.error('Error en prueba de conexión:', err);
    return { ok: false, message: 'Error de conexión: ' + (err.message || err.code || err) };
  }
}
