/**
 * Lógica Principal - Gestor de Órdenes de Trabajo (Impremta Comercial 1940)
 */

const STORAGE_KEY_ORDERS = 'imprenta_ordenes_db_v1';
const STORAGE_KEY_THEME = 'imprenta_theme_mode';

// Estado global de la aplicación
let appState = {
  orders: [],
  filteredOrders: [],
  currentOrder: null,
  isEditing: false,
  viewMode: 'grid', // 'grid' o 'table'
  filters: {
    cliente: '',
    fechaDesde: '',
    fechaHasta: '',
    busquedaGeneral: ''
  }
};

// Ejemplo real precargado basado en el archivo 441-7 - ROIDAL...
const EJEMPLO_ROIDAL = {
  id: 'ord-ejemplo-roidal',
  fecha: new Date().toISOString().split('T')[0],
  fechaEntrega: '',
  cliente: 'ROIDAL',
  attn: 'ANNA',
  entrega: '',
  tel: '',
  poblacion: '',
  presupuestoNo: '',
  pedidoNo: '',
  albaranNo: '',
  facturaNo: '260.288',
  precio: '390 €',
  observacionesTop: '',
  descCantidad: '10',
  descLinea1: 'Talonarios 50x3 imp. 1+1 tinta. CAST.',
  descLinea2: '10 Talonarios 50x3 imp. 1+1 tinta. TESSY CAST.',
  descLinea3: '',
  descLinea4: '',
  medidaFinal: 'A4 + TALADRO (1.5 cm)',
  tinta: 'NEGRA',
  numerado: '',
  papel: 'EUROCALCO',
  gramaje: '60 gr',
  medidaPapel: '',
  pedidoPapelCheck: false,
  pedidoPapel: '',
  cbCheck: true,
  cbTexto: 'blanco',
  cfbTopCheck: false,
  cfbTopTexto: '',
  cfbBotCheck: true,
  cfbBotTexto: 'rosa',
  cfCheck: true,
  cfTexto: 'amarillo',
  fecha_repeticion: '2024-05-10',
  numeroP_arriba: '26334',
  existencia_arriba: '',
  numeroG_arriba: '35',
  numeroP_abajo: '28359',
  existencia_abajo: '',
  numeroG_abajo: '67',
  tipografiaCheck: false,
  tipografiaNum: '',
  exaprintCheck: false,
  exaprintNum: '',
  impresplaCheck: true,
  impresplaNum: '',
  truyolCheck: false,
  truyolNum: '',
  grafixCheck: false,
  grafixNum: '',
  arponCheck: false,
  arponNum: '',
  compoCheck: false,
  compo45x32: false,
  compo48x33: false,
  compo48x32_5: false,
  hojas: '',
  otroCheck: false,
  otroTexto: '',
  pedidoProvCheck: false,
  pedidoProvNum: '',
  hendido: false,
  doblado: false,
  cosido: false,
  talonarios: true,
  encolado: false,
  cabeza: true,
  lomo: false,
  taladro: true,
  plastificado: false,
  brillo: false,
  mate: false,
  otrosAcabadosCheck: false,
  otrosAcabadosTexto: '',
  observaciones: ''
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  cargarOrdenesLocales();
  initCloudIntegration();
  bindUIEvents();
  aplicarFiltros();
});

// Inicializar tema claro / oscuro
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  setTheme(savedTheme);
  
  const themeToggle = document.getElementById('btnToggleTheme');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY_THEME, theme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Carga inicial de datos locales
function cargarOrdenesLocales() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (raw) {
      appState.orders = JSON.parse(raw);
    } else {
      // Si la base de datos está vacía, incluir el ejemplo de ROIDAL
      appState.orders = [EJEMPLO_ROIDAL];
      guardarOrdenesLocales();
    }
  } catch (e) {
    console.error('Error al cargar órdenes locales:', e);
    appState.orders = [EJEMPLO_ROIDAL];
  }
}

function guardarOrdenesLocales() {
  try {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(appState.orders));
  } catch (e) {
    console.error('Error al guardar órdenes locales:', e);
  }
}

// Inicializar integración en la Nube
function initCloudIntegration() {
  onCloudStatusChange((status) => {
    actualizarInsigniaNube(status);
  });

  const connected = initFirebase();
  if (connected) {
    onAuthStateChange((user) => {
      if (user) {
        // Usuario autenticado: iniciar sincronización segura con la nube
        suscribirCambiosNube((cloudOrders) => {
          if (cloudOrders && cloudOrders.length > 0) {
            fusionarOrdenesNube(cloudOrders);
          } else if (appState.orders && appState.orders.length > 0) {
            subirTodasLasOrdenesANube(appState.orders).then(() => {
              console.log('Órdenes locales sincronizadas en la nube Firestore.');
            }).catch(e => console.warn('Aviso sincronización inicial:', e));
          }
        });
      } else {
        // Sin usuario autenticado: detener listener para no violar reglas de seguridad
        if (typeof unsubscribeSnapshot === 'function') {
          unsubscribeSnapshot();
        }
        CloudStatus.isConnected = false;
        CloudStatus.statusMessage = 'Inicia sesión para sincronizar';
        notifyStatusChange();
      }
    });
  }
}

function fusionarOrdenesNube(cloudOrders) {
  const map = new Map();
  // Primero locales
  appState.orders.forEach(o => map.set(o.id, o));
  // Luego de la nube (tienen prioridad)
  cloudOrders.forEach(o => map.set(o.id, o));

  appState.orders = Array.from(map.values());
  guardarOrdenesLocales();
  aplicarFiltros();
}

function actualizarInsigniaNube(status) {
  const badge = document.getElementById('cloudStatusBadge');
  const text = document.getElementById('cloudStatusText');
  if (!badge || !text) return;

  if (status.currentUser && status.isConnected) {
    badge.className = 'cloud-status-badge connected';
    text.textContent = 'Nube Conectada';
    badge.title = status.lastSyncTime 
      ? `Sincronizado a las ${status.lastSyncTime.toLocaleTimeString()}`
      : 'Sincronización en tiempo real activa';
  } else if (!status.currentUser) {
    badge.className = 'cloud-status-badge local';
    text.textContent = '🔒 Inicia Sesión';
    badge.title = 'Inicia sesión con tu usuario para sincronizar con la nube protegida';
  } else if (status.isConfigured) {
    badge.className = 'cloud-status-badge local';
    text.textContent = 'Conectando Nube...';
    badge.title = status.statusMessage;
  } else {
    badge.className = 'cloud-status-badge local';
    text.textContent = 'Modo Local';
    badge.title = 'Haz clic para conectar Firebase';
  }
}

// ==========================================================================
// FILTROS Y BÚSQUEDA
// ==========================================================================
function aplicarFiltros() {
  const { cliente, fechaDesde, fechaHasta, busquedaGeneral } = appState.filters;

  const clienteQ = cliente.trim().toLowerCase();
  const generalQ = busquedaGeneral.trim().toLowerCase();

  appState.filteredOrders = appState.orders.filter(order => {
    // 1. Filtro por Cliente
    if (clienteQ && (!order.cliente || !order.cliente.toLowerCase().includes(clienteQ))) {
      return false;
    }

    // 2. Filtro por Rango de Fechas
    const orderFecha = order.fecha || '';
    if (fechaDesde && orderFecha && orderFecha < fechaDesde) {
      return false;
    }
    if (fechaHasta && orderFecha && orderFecha > fechaHasta) {
      return false;
    }

    // 3. Búsqueda General (múltiples campos)
    if (generalQ) {
      const match = (
        (order.cliente && order.cliente.toLowerCase().includes(generalQ)) ||
        (order.attn && order.attn.toLowerCase().includes(generalQ)) ||
        (order.poblacion && order.poblacion.toLowerCase().includes(generalQ)) ||
        (order.tel && order.tel.toLowerCase().includes(generalQ)) ||
        (order.facturaNo && order.facturaNo.toLowerCase().includes(generalQ)) ||
        (order.albaranNo && order.albaranNo.toLowerCase().includes(generalQ)) ||
        (order.presupuestoNo && order.presupuestoNo.toLowerCase().includes(generalQ)) ||
        (order.pedidoNo && order.pedidoNo.toLowerCase().includes(generalQ)) ||
        (order.numeroP_abajo && order.numeroP_abajo.toLowerCase().includes(generalQ)) ||
        (order.numeroG_abajo && order.numeroG_abajo.toLowerCase().includes(generalQ)) ||
        (order.numeroP_arriba && order.numeroP_arriba.toLowerCase().includes(generalQ)) ||
        (order.numeroG_arriba && order.numeroG_arriba.toLowerCase().includes(generalQ)) ||
        (order.descLinea1 && order.descLinea1.toLowerCase().includes(generalQ)) ||
        (order.descLinea2 && order.descLinea2.toLowerCase().includes(generalQ)) ||
        (order.papel && order.papel.toLowerCase().includes(generalQ)) ||
        (order.observaciones && order.observaciones.toLowerCase().includes(generalQ))
      );
      if (!match) return false;
    }

    return true;
  });

  // Ordenar por fecha descendente
  appState.filteredOrders.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  renderOrdersList();
  renderClientAutocomplete();
}

function getDistinctClients() {
  const set = new Set();
  appState.orders.forEach(o => {
    if (o.cliente && o.cliente.trim()) {
      set.add(o.cliente.trim());
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function renderClientAutocomplete() {
  const dropdown = document.getElementById('clientSuggestions');
  const input = document.getElementById('filterCliente');
  if (!dropdown || !input) return;

  const q = input.value.trim().toLowerCase();
  const clients = getDistinctClients();
  const matches = q ? clients.filter(c => c.toLowerCase().includes(q)) : clients;

  if (matches.length === 0 || (!q && document.activeElement !== input)) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = matches.map(c => `
    <div class="autocomplete-item" data-value="${escapeHtml(c)}">${escapeHtml(c)}</div>
  `).join('');

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      input.value = item.getAttribute('data-value');
      appState.filters.cliente = input.value;
      dropdown.style.display = 'none';
      aplicarFiltros();
    });
  });
}

// ==========================================================================
// RENDERIZADO DE LA LISTA DE ÓRDENES (PROTEGIDO POR AUTENTICACIÓN)
// ==========================================================================
function renderOrdersList() {
  const container = document.getElementById('ordersContainer');
  const countSpan = document.getElementById('resultsCountSpan');
  const filterCard = document.querySelector('.filter-card');
  const resultsHeader = document.querySelector('.results-header');

  if (!container) return;

  // Comprobar si el usuario está autenticado
  const user = (typeof obtenerUsuarioActual === 'function') ? obtenerUsuarioActual() : null;
  if (!user) {
    // Ocultar filtros y cabecera de resultados si no ha iniciado sesión
    if (filterCard) filterCard.style.display = 'none';
    if (resultsHeader) resultsHeader.style.display = 'none';

    container.className = '';
    container.innerHTML = `
      <div class="lock-screen-card">
        <div style="font-size: 3.5rem; margin-bottom: 0.75rem;">🔒</div>
        <h2 style="font-size: 1.45rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-main);">
          Acceso Protegido
        </h2>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem; font-size: 0.95rem; line-height: 1.5;">
          Por privacidad y seguridad, las órdenes de trabajo, clientes y precios solo son visibles para usuarios autorizados de la imprenta.
        </p>
        <button class="btn btn-primary" onclick="abrirModalAuth()" style="padding: 0.75rem 1.75rem; font-size: 1rem; box-shadow: var(--shadow-md);">
          🔑 Iniciar Sesión para Ver Órdenes
        </button>
      </div>
    `;
    return;
  }

  // Usuario autenticado: mostrar barra de filtros y resultados
  if (filterCard) filterCard.style.display = 'block';
  if (resultsHeader) resultsHeader.style.display = 'flex';
  if (countSpan) countSpan.textContent = appState.filteredOrders.length;

  if (appState.filteredOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No se encontraron órdenes de trabajo</h3>
        <p>Prueba a cambiar o limpiar los filtros de búsqueda, o crea una nueva orden con el botón superior.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 1rem;" id="btnResetFiltersEmpty">
          Limpiar Filtros
        </button>
      </div>
    `;
    const btnReset = document.getElementById('btnResetFiltersEmpty');
    if (btnReset) btnReset.addEventListener('click', resetFiltros);
    return;
  }

  if (appState.viewMode === 'grid') {
    container.className = 'orders-grid';
    container.innerHTML = appState.filteredOrders.map(order => createOrderCardHtml(order)).join('');
  } else {
    container.className = 'orders-table-wrapper';
    container.style.display = 'block';
    container.innerHTML = `
      <table class="orders-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Descripción</th>
            <th>P / G Actual</th>
            <th>P / G Repet.</th>
            <th>Factura / Alb.</th>
            <th>Precio</th>
            <th style="text-align: right;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${appState.filteredOrders.map(order => createOrderTableRowHtml(order)).join('')}
        </tbody>
      </table>
    `;
  }

  // Enlazar eventos de acciones en cada elemento renderizado
  attachOrderActionEvents(container);
}

function createOrderCardHtml(order) {
  const fechaStr = formatearFecha(order.fecha) || 'Sin fecha';
  const cliente = escapeHtml(order.cliente || 'Sin Cliente');
  const desc = [
    order.descCantidad ? `<strong>${escapeHtml(order.descCantidad)}</strong>` : '',
    escapeHtml(order.descLinea1 || ''),
    escapeHtml(order.descLinea2 || '')
  ].filter(Boolean).join(' ');

  const pAbajo = order.numeroP_abajo ? `P: ${escapeHtml(order.numeroP_abajo)}` : '';
  const gAbajo = order.numeroG_abajo ? `G: ${escapeHtml(order.numeroG_abajo)}` : '';
  const pArriba = order.numeroP_arriba ? `Ant. P: ${escapeHtml(order.numeroP_arriba)}` : '';

  return `
    <div class="order-card" data-id="${order.id}">
      <div class="order-card-header">
        <div class="order-client-name">${cliente}</div>
        <div class="order-date-badge">${fechaStr}</div>
      </div>

      <div class="order-meta-info">
        ${order.attn ? `<div><strong>Attn:</strong> ${escapeHtml(order.attn)}</div>` : ''}
        ${order.poblacion || order.tel ? `<div>${escapeHtml(order.poblacion || '')} ${order.tel ? '· Tel: ' + escapeHtml(order.tel) : ''}</div>` : ''}
      </div>

      <div class="order-description-box">
        ${desc || '<em>Sin descripción</em>'}
      </div>

      <div class="order-numbers-row">
        <div class="num-item">
          <span class="num-val">${pAbajo} ${gAbajo}</span>
          ${pArriba ? `<span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 4px;">(${pArriba})</span>` : ''}
        </div>
        ${order.precio ? `<div class="price-badge">${escapeHtml(order.precio)}</div>` : ''}
      </div>

      <div class="order-card-actions">
        <button class="btn btn-secondary btn-sm btn-print" data-id="${order.id}" title="Imprimir PDF directo">
          🖨️ Imprimir
        </button>
        <button class="btn btn-repeat btn-sm btn-repeat-job" data-id="${order.id}" title="Generar nueva orden copiando datos, con campos P y G actualizados y presupuesto en blanco">
          🔄 Repetir
        </button>
        <button class="btn btn-secondary btn-sm btn-edit" data-id="${order.id}">
          ✏️ Editar
        </button>
        <button class="btn btn-secondary btn-sm btn-download" data-id="${order.id}" title="Descargar archivo PDF">
          ⬇️ PDF
        </button>
      </div>
    </div>
  `;
}

function createOrderTableRowHtml(order) {
  const fechaStr = formatearFecha(order.fecha) || '-';
  const cliente = escapeHtml(order.cliente || 'Sin Cliente');
  const desc = escapeHtml((order.descLinea1 || '') + (order.descLinea2 ? ' / ' + order.descLinea2 : ''));
  const actualPG = [order.numeroP_abajo ? 'P: ' + order.numeroP_abajo : '', order.numeroG_abajo ? 'G: ' + order.numeroG_abajo : ''].filter(Boolean).join(' ');
  const repPG = [order.numeroP_arriba ? 'P: ' + order.numeroP_arriba : '', order.numeroG_arriba ? 'G: ' + order.numeroG_arriba : ''].filter(Boolean).join(' ');
  const facAlb = [order.facturaNo ? 'Fac: ' + order.facturaNo : '', order.albaranNo ? 'Alb: ' + order.albaranNo : ''].filter(Boolean).join(' / ');

  return `
    <tr data-id="${order.id}">
      <td style="white-space: nowrap; font-weight: 600;">${fechaStr}</td>
      <td style="font-weight: 800;">${cliente}</td>
      <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${desc}</td>
      <td style="font-family: var(--font-mono); font-weight: 700;">${actualPG || '-'}</td>
      <td style="font-family: var(--font-mono); color: var(--text-muted);">${repPG || '-'}</td>
      <td>${facAlb || '-'}</td>
      <td style="font-weight: 800; color: #059669;">${order.precio ? escapeHtml(order.precio) : '-'}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn btn-secondary btn-sm btn-print" data-id="${order.id}" title="Imprimir PDF">🖨️</button>
        <button class="btn btn-repeat btn-sm btn-repeat-job" data-id="${order.id}" title="Repetir trabajo">🔄 Repetir</button>
        <button class="btn btn-secondary btn-sm btn-edit" data-id="${order.id}" title="Editar">✏️</button>
        <button class="btn btn-secondary btn-sm btn-download" data-id="${order.id}" title="Descargar PDF">⬇️</button>
        <button class="btn btn-secondary btn-sm btn-delete" data-id="${order.id}" title="Eliminar" style="color: var(--danger);">🗑️</button>
      </td>
    </tr>
  `;
}

function attachOrderActionEvents(container) {
  // Imprimir
  container.querySelectorAll('.btn-print').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const order = appState.orders.find(o => o.id === id);
      if (order) imprimirPdfDirecto(order);
    });
  });

  // Descargar PDF
  container.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const order = appState.orders.find(o => o.id === id);
      if (order) descargarPdf(order);
    });
  });

  // Editar
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const order = appState.orders.find(o => o.id === id);
      if (order) abrirEditorOrden(order, false);
    });
  });

  // REPETICIÓN DE TRABAJO (Requisito clave del usuario)
  container.querySelectorAll('.btn-repeat-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const order = appState.orders.find(o => o.id === id);
      if (order) ejecutarRepeticionTrabajo(order);
    });
  });

  // Eliminar
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      confirmarEliminarOrden(id);
    });
  });
}

// ==========================================================================
// REGLA DE NEGOCIO: REPETICIÓN DE TRABAJO
// "En este caso copiará en la nueva todos los datos salvo presupuesto.
//  Como es una repetición de trabajo copiará el valor de Numero P y numero G
//  de abajo en los campos de arriba, dejando los primeros en blanco"
// ==========================================================================
function ejecutarRepeticionTrabajo(ordenOriginal) {
  // 1. Clonar todos los datos
  const nueva = JSON.parse(JSON.stringify(ordenOriginal));

  // 2. Nuevo identificador único y fecha de hoy
  nueva.id = 'ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  nueva.fecha = new Date().toISOString().split('T')[0];
  nueva.fechaEntrega = '';

  // 3. REGLA: "salvo presupuesto" -> queda en blanco
  nueva.presupuestoNo = '';
  nueva.albaranNo = '';
  nueva.facturaNo = '';

  // 4. REGLA: "copiará el valor de Numero P y numero G de abajo en los campos de arriba, dejando los primeros en blanco"
  // Los valores inferiores (abajo) pasan a los campos superiores (arriba / repetición):
  nueva.numeroP_arriba = ordenOriginal.numeroP_abajo || '';
  nueva.numeroG_arriba = ordenOriginal.numeroG_abajo || '';
  nueva.existencia_arriba = ordenOriginal.existencia_abajo || '';
  nueva.fecha_repeticion = ordenOriginal.fecha || '';

  // Los campos de abajo (trabajo actual a reasignar) quedan en blanco:
  nueva.numeroP_abajo = '';
  nueva.numeroG_abajo = '';
  nueva.existencia_abajo = '';

  // 5. Abrir editor con la nueva orden
  abrirEditorOrden(nueva, true);

  mostrarToast(
    `🔄 Repetición creada para "${nueva.cliente}". P y G anteriores copiados arriba (P: ${nueva.numeroP_arriba}, G: ${nueva.numeroG_arriba}). Presupuesto y nuevos números en blanco.`,
    'info'
  );
}

// ==========================================================================
// FORMULARIO Y EDITOR DE ORDEN
// ==========================================================================
function abrirEditorOrden(order, esNueva = false) {
  appState.currentOrder = JSON.parse(JSON.stringify(order));
  appState.isEditing = !esNueva;

  const modal = document.getElementById('orderModal');
  const modalTitle = document.getElementById('modalOrderTitle');
  if (modalTitle) {
    if (esNueva) {
      modalTitle.textContent = order.numeroP_arriba 
        ? `🔄 Nueva Orden por Repetición: ${order.cliente || ''}`
        : '✨ Nueva Orden de Trabajo';
    } else {
      modalTitle.textContent = `✏️ Editando Orden: ${order.cliente || ''}`;
    }
  }

  poblarFormulario(appState.currentOrder);
  actualizarPrevisualizacionHoja(appState.currentOrder);

  modal.classList.add('active');
}

function cerrarModalOrden() {
  const modal = document.getElementById('orderModal');
  modal.classList.remove('active');
  appState.currentOrder = null;
}

function poblarFormulario(order) {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const fields = [
    'fecha', 'fechaEntrega', 'cliente', 'attn', 'entrega', 'tel', 'poblacion',
    'presupuestoNo', 'pedidoNo', 'albaranNo', 'facturaNo', 'precio', 'observacionesTop',
    'descCantidad', 'descLinea1', 'descLinea2', 'descLinea3', 'descLinea4',
    'medidaFinal', 'tinta', 'numerado', 'papel', 'gramaje', 'medidaPapel', 'pedidoPapel',
    'cbTexto', 'cfbTopTexto', 'cfbBotTexto', 'cfTexto',
    'fecha_repeticion', 'numeroP_arriba', 'existencia_arriba', 'numeroG_arriba',
    'numeroP_abajo', 'existencia_abajo', 'numeroG_abajo',
    'tipografiaNum', 'exaprintNum', 'impresplaNum', 'truyolNum', 'grafixNum', 'arponNum',
    'hojas', 'otroTexto', 'pedidoProvNum', 'otrosAcabadosTexto', 'observaciones'
  ];

  fields.forEach(field => {
    const el = form.elements[field];
    if (el) el.value = order[field] || '';
  });

  const checkboxes = [
    'pedidoPapelCheck', 'cbCheck', 'cfbTopCheck', 'cfbBotCheck', 'cfCheck',
    'tipografiaCheck', 'exaprintCheck', 'impresplaCheck', 'truyolCheck', 'grafixCheck', 'arponCheck',
    'compoCheck', 'compo45x32', 'compo48x33', 'compo48x32_5', 'otroCheck', 'pedidoProvCheck',
    'hendido', 'doblado', 'cosido', 'talonarios', 'encolado', 'cabeza', 'lomo', 'taladro',
    'plastificado', 'brillo', 'mate', 'otrosAcabadosCheck'
  ];

  checkboxes.forEach(cb => {
    const el = form.elements[cb];
    if (el) el.checked = Boolean(order[cb]);
  });
}

function recolectarDatosFormulario() {
  const form = document.getElementById('orderForm');
  if (!form) return null;

  const order = { ...appState.currentOrder };

  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') {
      order[el.name] = el.checked;
    } else {
      order[el.name] = el.value.trim();
    }
  });

  return order;
}

// Actualización en tiempo real de la previsualización
function onFormChangeLive() {
  const current = recolectarDatosFormulario();
  if (current) {
    appState.currentOrder = current;
    actualizarPrevisualizacionHoja(current);
  }
}

function actualizarPrevisualizacionHoja(o) {
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  };
  const setCheck = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.textContent = checked ? ' [X] ' : ' [ ] ';
  };

  setText('prevFecha', formatearFecha(o.fecha));
  setText('prevFechaEntrega', formatearFecha(o.fechaEntrega));
  setText('prevCliente', o.cliente);
  setText('prevAttn', o.attn);
  setText('prevEntrega', o.entrega);
  setText('prevTel', o.tel);
  setText('prevPoblacion', o.poblacion);

  setText('prevPresupuesto', o.presupuestoNo);
  setText('prevPedido', o.pedidoNo);
  setText('prevAlbaran', o.albaranNo);
  setText('prevFactura', o.facturaNo);
  setText('prevPrecio', o.precio);

  setText('prevDescCant', o.descCantidad);
  setText('prevDescL1', o.descLinea1);
  setText('prevDescL2', o.descLinea2);
  setText('prevMedidaFinal', o.medidaFinal);
  setText('prevTinta', o.tinta);
  setText('prevNumerado', o.numerado);
  setText('prevPapel', o.papel);
  setText('prevGramaje', o.gramaje);

  // Números P y G
  setText('prevP_arriba', o.numeroP_arriba);
  setText('prevG_arriba', o.numeroG_arriba);
  setText('prevP_abajo', o.numeroP_abajo);
  setText('prevG_abajo', o.numeroG_abajo);

  // Observaciones
  setText('prevObservaciones', o.observaciones);
}

// Guardar orden desde el modal
async function guardarOrdenActual() {
  const order = recolectarDatosFormulario();
  if (!order) return;

  if (!order.cliente) {
    alert('Por favor, indica al menos el nombre del Cliente.');
    return;
  }

  // Si no tenía ID generar uno
  if (!order.id) {
    order.id = 'ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }

  // Actualizar o añadir a la lista local
  const index = appState.orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    appState.orders[index] = order;
  } else {
    appState.orders.unshift(order);
  }

  guardarOrdenesLocales();
  aplicarFiltros();
  cerrarModalOrden();
  mostrarToast(`✅ Orden guardada correctamente: "${order.cliente}"`, 'success');

  // Guardar en la nube si está activa
  guardarOrdenEnNube(order).then(ok => {
    if (ok) console.log('Orden sincronizada en la nube Firestore.');
  });
}

function confirmarEliminarOrden(id) {
  const order = appState.orders.find(o => o.id === id);
  const cliente = order ? order.cliente : '';
  if (confirm(`¿Estás seguro de que deseas eliminar la orden de trabajo de "${cliente}"?`)) {
    appState.orders = appState.orders.filter(o => o.id !== id);
    guardarOrdenesLocales();
    aplicarFiltros();
    mostrarToast('🗑️ Orden eliminada.', 'info');
    eliminarOrdenDeNube(id);
  }
}

// ==========================================================================
// EVENTOS DE LA INTERFAZ
// ==========================================================================
function bindUIEvents() {
  // Botón Nueva Orden
  document.getElementById('btnNewOrder').addEventListener('click', () => {
    const user = (typeof obtenerUsuarioActual === 'function') ? obtenerUsuarioActual() : null;
    if (!user) {
      abrirModalAuth();
      mostrarToast('🔒 Inicia sesión para crear o gestionar órdenes de trabajo.', 'warning');
      return;
    }
    const nueva = {
      id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fecha: new Date().toISOString().split('T')[0],
      fechaEntrega: '',
      cliente: '',
      attn: '',
      entrega: '',
      tel: '',
      poblacion: '',
      presupuestoNo: '',
      pedidoNo: '',
      albaranNo: '',
      facturaNo: '',
      precio: '',
      observacionesTop: '',
      descCantidad: '',
      descLinea1: '',
      descLinea2: '',
      descLinea3: '',
      descLinea4: '',
      medidaFinal: '',
      tinta: '',
      numerado: '',
      papel: '',
      gramaje: '',
      medidaPapel: '',
      pedidoPapelCheck: false,
      pedidoPapel: '',
      cbCheck: false,
      cbTexto: '',
      cfbTopCheck: false,
      cfbTopTexto: '',
      cfbBotCheck: false,
      cfbBotTexto: '',
      cfCheck: false,
      cfTexto: '',
      fecha_repeticion: '',
      numeroP_arriba: '',
      existencia_arriba: '',
      numeroG_arriba: '',
      numeroP_abajo: '',
      existencia_abajo: '',
      numeroG_abajo: '',
      tipografiaCheck: false,
      tipografiaNum: '',
      exaprintCheck: false,
      exaprintNum: '',
      impresplaCheck: false,
      impresplaNum: '',
      truyolCheck: false,
      truyolNum: '',
      grafixCheck: false,
      grafixNum: '',
      arponCheck: false,
      arponNum: '',
      compoCheck: false,
      compo45x32: false,
      compo48x33: false,
      compo48x32_5: false,
      hojas: '',
      otroCheck: false,
      otroTexto: '',
      pedidoProvCheck: false,
      pedidoProvNum: '',
      hendido: false,
      doblado: false,
      cosido: false,
      talonarios: false,
      encolado: false,
      cabeza: false,
      lomo: false,
      taladro: false,
      plastificado: false,
      brillo: false,
      mate: false,
      otrosAcabadosCheck: false,
      otrosAcabadosTexto: '',
      observaciones: ''
    };
    abrirEditorOrden(nueva, true);
  });

  // Filtros de entrada
  const filterCliente = document.getElementById('filterCliente');
  filterCliente.addEventListener('input', (e) => {
    appState.filters.cliente = e.target.value;
    aplicarFiltros();
  });
  filterCliente.addEventListener('focus', renderClientAutocomplete);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#clientSuggestions') && e.target !== filterCliente) {
      const drop = document.getElementById('clientSuggestions');
      if (drop) drop.style.display = 'none';
    }
  });

  document.getElementById('filterFechaDesde').addEventListener('change', (e) => {
    appState.filters.fechaDesde = e.target.value;
    aplicarFiltros();
  });
  document.getElementById('filterFechaHasta').addEventListener('change', (e) => {
    appState.filters.fechaHasta = e.target.value;
    aplicarFiltros();
  });
  document.getElementById('filterGeneral').addEventListener('input', (e) => {
    appState.filters.busquedaGeneral = e.target.value;
    aplicarFiltros();
  });

  // Limpiar filtros
  document.getElementById('btnClearFilters').addEventListener('click', resetFiltros);

  // Chips de atajo de fechas
  document.querySelectorAll('.quick-date-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.quick-date-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const range = chip.getAttribute('data-range');
      aplicarAtajoFecha(range);
    });
  });

  // Controles de Vista (Grid vs Tabla)
  document.getElementById('btnViewGrid').addEventListener('click', () => {
    appState.viewMode = 'grid';
    document.getElementById('btnViewGrid').classList.add('btn-primary');
    document.getElementById('btnViewGrid').classList.remove('btn-secondary');
    document.getElementById('btnViewTable').classList.remove('btn-primary');
    document.getElementById('btnViewTable').classList.add('btn-secondary');
    renderOrdersList();
  });
  document.getElementById('btnViewTable').addEventListener('click', () => {
    appState.viewMode = 'table';
    document.getElementById('btnViewTable').classList.add('btn-primary');
    document.getElementById('btnViewTable').classList.remove('btn-secondary');
    document.getElementById('btnViewGrid').classList.remove('btn-primary');
    document.getElementById('btnViewGrid').classList.add('btn-secondary');
    renderOrdersList();
  });

  // Eventos del Formulario Modal
  const form = document.getElementById('orderForm');
  form.addEventListener('input', onFormChangeLive);
  form.addEventListener('change', onFormChangeLive);

  document.getElementById('btnSaveOrder').addEventListener('click', guardarOrdenActual);
  document.getElementById('btnCloseModal').addEventListener('click', cerrarModalOrden);
  document.getElementById('btnCancelModal').addEventListener('click', cerrarModalOrden);

  // Imprimir directo desde modal
  document.getElementById('btnPrintModal').addEventListener('click', () => {
    const o = recolectarDatosFormulario();
    if (o) imprimirPdfDirecto(o);
  });

  // Descargar PDF desde modal
  document.getElementById('btnDownloadModal').addEventListener('click', () => {
    const o = recolectarDatosFormulario();
    if (o) descargarPdf(o);
  });

  // Repetir Trabajo desde dentro del modal
  document.getElementById('btnRepeatModal').addEventListener('click', () => {
    const current = recolectarDatosFormulario();
    if (current) ejecutarRepeticionTrabajo(current);
  });

  // Backup & Restore
  document.getElementById('btnBackupExport').addEventListener('click', exportarBaseDatosJson);
  document.getElementById('btnBackupImport').addEventListener('click', () => {
    document.getElementById('fileImportInput').click();
  });
  document.getElementById('fileImportInput').addEventListener('change', importarBaseDatosJson);

  // Modal de Configuración de Nube
  document.getElementById('cloudStatusBadge').addEventListener('click', abrirModalNube);
  document.getElementById('btnCloudSettingsNav').addEventListener('click', abrirModalNube);
  document.getElementById('btnCloseCloudModal').addEventListener('click', cerrarModalNube);
  document.getElementById('btnCancelCloudModal').addEventListener('click', cerrarModalNube);
  document.getElementById('btnSaveCloudConfig').addEventListener('click', guardarConfiguracionNube);
  document.getElementById('btnTestCloudConnection').addEventListener('click', probarConexionNube);
  document.getElementById('btnUploadLocalToCloud').addEventListener('click', sincronizarLocalesANube);

  // Modal de Autenticación / Privacidad
  document.getElementById('btnAuthUser').addEventListener('click', abrirModalAuth);
  document.getElementById('btnCloseAuthModal').addEventListener('click', cerrarModalAuth);
  document.getElementById('btnCancelAuthModal').addEventListener('click', cerrarModalAuth);
  document.getElementById('btnLogin').addEventListener('click', ejecutarLogin);
  const btnReg = document.getElementById('btnRegister');
  if (btnReg) btnReg.addEventListener('click', ejecutarRegistro);
  document.getElementById('btnLogout').addEventListener('click', ejecutarLogout);

  // Cerrar modales al pulsar el fondo oscuro
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Cerrar modales con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });
}

// Funciones de Autenticación y Privacidad UI
function abrirModalAuth() {
  const modal = document.getElementById('authModal');
  const user = obtenerUsuarioActual ? obtenerUsuarioActual() : null;
  const loggedSection = document.getElementById('authLoggedSection');
  const form = document.getElementById('authForm');
  const errorDiv = document.getElementById('authErrorMessage');
  if (errorDiv) errorDiv.style.display = 'none';

  if (user) {
    loggedSection.style.display = 'block';
    form.style.display = 'none';
    document.getElementById('authLoggedEmail').textContent = user.email || 'Usuario';
  } else {
    loggedSection.style.display = 'none';
    form.style.display = 'block';
  }

  modal.classList.add('active');
}

function cerrarModalAuth() {
  document.getElementById('authModal').classList.remove('active');
}

function actualizarEstadoUsuarioUI(user) {
  const btn = document.getElementById('btnAuthUser');
  const icon = document.getElementById('authIcon');
  const text = document.getElementById('authText');
  if (!btn || !text) return;

  if (user) {
    icon.textContent = '👤';
    const emailParts = (user.email || 'Usuario').split('@');
    text.textContent = emailParts[0];
    btn.classList.add('btn-success');
    btn.classList.remove('btn-secondary');
    btn.title = `Sesión iniciada como: ${user.email}`;
  } else {
    icon.textContent = '🔒';
    text.textContent = 'Iniciar Sesión';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    btn.title = 'Acceso de Usuario y Privacidad';
  }

  // Refrescar inmediatamente la lista para mostrar u ocultar tarjetas según autenticación
  renderOrdersList();
}

async function ejecutarLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  const errorDiv = document.getElementById('authErrorMessage');
  errorDiv.style.display = 'none';

  if (!email || !pass) {
    errorDiv.textContent = 'Introduce tu correo y contraseña.';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    document.getElementById('btnLogin').textContent = 'Comprobando...';
    await iniciarSesion(email, pass);
    document.getElementById('btnLogin').textContent = '🔑 Iniciar Sesión';
    cerrarModalAuth();
    mostrarToast(`👤 Sesión iniciada con éxito: ${email}`, 'success');
  } catch (err) {
    document.getElementById('btnLogin').textContent = '🔑 Iniciar Sesión';
    let msg = 'Error al iniciar sesión.';
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      msg = 'Usuario o contraseña incorrectos. Si aún no has creado este usuario en Firebase, pulsa "Registrar nuevo usuario".';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'El formato del correo electrónico no es válido.';
    } else if (err.code === 'auth/operation-not-allowed') {
      msg = 'El proveedor de Correo/Contraseña no está habilitado en Firebase. Actívalo en la consola de Firebase > Authentication > Método de acceso.';
    } else {
      msg = err.message || err.code || msg;
    }
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
}

async function ejecutarRegistro() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  const errorDiv = document.getElementById('authErrorMessage');
  errorDiv.style.display = 'none';

  if (!email || !pass) {
    errorDiv.textContent = 'Introduce tu correo y una contraseña de al menos 6 caracteres.';
    errorDiv.style.display = 'block';
    return;
  }

  if (pass.length < 6) {
    errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    document.getElementById('btnRegister').textContent = 'Registrando...';
    await registrarUsuario(email, pass);
    document.getElementById('btnRegister').textContent = 'Registrar nuevo usuario en Firebase';
    cerrarModalAuth();
    mostrarToast(`✅ Usuario creado y sesión iniciada: ${email}`, 'success');
  } catch (err) {
    document.getElementById('btnRegister').textContent = 'Registrar nuevo usuario en Firebase';
    let msg = 'Error al registrar usuario.';
    if (err.code === 'auth/email-already-in-use') {
      msg = 'Este correo ya está registrado. Pulsa en "Iniciar Sesión" con su contraseña.';
    } else if (err.code === 'auth/operation-not-allowed') {
      msg = 'El proveedor de Correo/Contraseña no está habilitado en Firebase. En la consola de Firebase ve a Authentication > Método de acceso > Correo electrónico y márcalo como Habilitado.';
    } else {
      msg = err.message || err.code || msg;
    }
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
}

async function ejecutarLogout() {
  try {
    await cerrarSesion();
    cerrarModalAuth();
    mostrarToast('🔒 Sesión cerrada.', 'info');
  } catch (err) {
    alert('Error al cerrar sesión: ' + err.message);
  }
}

function resetFiltros() {
  appState.filters = { cliente: '', fechaDesde: '', fechaHasta: '', busquedaGeneral: '' };
  document.getElementById('filterCliente').value = '';
  document.getElementById('filterFechaDesde').value = '';
  document.getElementById('filterFechaHasta').value = '';
  document.getElementById('filterGeneral').value = '';
  document.querySelectorAll('.quick-date-chips .chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.quick-date-chips .chip[data-range="all"]').classList.add('active');
  aplicarFiltros();
}

function aplicarAtajoFecha(range) {
  const hoy = new Date();
  const format = (d) => d.toISOString().split('T')[0];

  let desde = '';
  let hasta = format(hoy);

  if (range === 'today') {
    desde = hasta;
  } else if (range === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    desde = format(d);
  } else if (range === 'month') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    desde = format(d);
  } else if (range === '3months') {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    desde = format(d);
  } else if (range === 'all') {
    desde = '';
    hasta = '';
  }

  appState.filters.fechaDesde = desde;
  appState.filters.fechaHasta = hasta;
  document.getElementById('filterFechaDesde').value = desde;
  document.getElementById('filterFechaHasta').value = hasta;
  aplicarFiltros();
}

// ==========================================================================
// CONFIGURACIÓN DE LA NUBE (FIREBASE)
// ==========================================================================
function abrirModalNube() {
  const modal = document.getElementById('cloudModal');
  const textarea = document.getElementById('firebaseConfigJson');
  const stored = getStoredFirebaseConfig();
  if (stored && textarea) {
    textarea.value = JSON.stringify(stored, null, 2);
  }
  modal.classList.add('active');
}

function cerrarModalNube() {
  document.getElementById('cloudModal').classList.remove('active');
}

async function guardarConfiguracionNube() {
  const textarea = document.getElementById('firebaseConfigJson');
  const val = textarea.value.trim();

  if (!val) {
    if (confirm('¿Deseas desvincular la nube y volver al modo local?')) {
      saveFirebaseConfig(null);
      initFirebase(null);
      cerrarModalNube();
      mostrarToast('Modo Local activo.', 'info');
    }
    return;
  }

  try {
    let cfg;
    // Si pegaron formato objeto JavaScript o JSON
    if (val.startsWith('{')) {
      cfg = JSON.parse(val);
    } else {
      // Intentar limpiar const firebaseConfig = { ... }
      const match = val.match(/\{[\s\S]*\}/);
      if (match) {
        // transformar claves a JSON válido si no tenían comillas
        const jsonStr = match[0].replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":').replace(/'/g, '"');
        cfg = JSON.parse(jsonStr);
      } else {
        throw new Error('Formato no reconocido. Pega el objeto JSON de firebaseConfig.');
      }
    }

    saveFirebaseConfig(cfg);
    const ok = initFirebase(cfg);
    if (ok) {
      suscribirCambiosNube((cloudOrders) => {
        if (cloudOrders && cloudOrders.length > 0) fusionarOrdenesNube(cloudOrders);
      });
      cerrarModalNube();
      mostrarToast('☁️ ¡Nube conectada con éxito! Sincronización activa en tiempo real.', 'success');
    } else {
      alert('La configuración no parece válida. Comprueba los datos.');
    }
  } catch (err) {
    alert('Error al procesar la configuración: ' + err.message);
  }
}

async function probarConexionNube() {
  const textarea = document.getElementById('firebaseConfigJson');
  const statusDiv = document.getElementById('cloudTestResult');
  statusDiv.textContent = 'Probando conexión...';
  statusDiv.style.color = 'var(--text-muted)';

  try {
    const val = textarea.value.trim();
    const match = val.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Pega primero el objeto de configuración.');
    const jsonStr = match[0].replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":').replace(/'/g, '"');
    const cfg = JSON.parse(jsonStr);

    const res = await testFirebaseConnection(cfg);
    statusDiv.textContent = res.message;
    statusDiv.style.color = res.ok ? 'var(--success)' : 'var(--danger)';
  } catch (err) {
    statusDiv.textContent = 'Error: ' + err.message;
    statusDiv.style.color = 'var(--danger)';
  }
}

async function sincronizarLocalesANube() {
  if (!CloudStatus.isConnected) {
    alert('Primero debes guardar y conectar la nube.');
    return;
  }
  if (confirm(`¿Deseas subir las ${appState.orders.length} órdenes locales a la nube Firestore?`)) {
    try {
      await subirTodasLasOrdenesANube(appState.orders);
      mostrarToast('☁️ Todas las órdenes locales se han sincronizado con la nube.', 'success');
    } catch (err) {
      alert('Error al subir a la nube: ' + err.message);
    }
  }
}

// ==========================================================================
// EXPORTAR / IMPORTAR COPIA DE SEGURIDAD (JSON)
// ==========================================================================
function exportarBaseDatosJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.orders, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `copia_seguridad_ordenes_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  mostrarToast('💾 Copia de seguridad JSON descargada.', 'success');
}

function importarBaseDatosJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        if (confirm(`¿Importar ${imported.length} órdenes? Se añadirán a las existentes.`)) {
          fusionarOrdenesNube(imported);
          mostrarToast(`✅ ${imported.length} órdenes importadas correctamente.`, 'success');
        }
      } else {
        alert('El archivo no contiene un listado de órdenes válido.');
      }
    } catch (err) {
      alert('Error al leer el archivo JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ==========================================================================
// UTILIDADES
// ==========================================================================
function mostrarToast(mensaje, tipo = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
