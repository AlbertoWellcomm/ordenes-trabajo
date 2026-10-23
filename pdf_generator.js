/**
 * Generador de PDF para Órdenes de Trabajo - Impremta Comercial 1940
 * Utiliza pdf-lib para estampar los datos en las coordenadas exactas de la plantilla original.
 */

// Función auxiliar para convertir Base64 a Uint8Array
function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Función auxiliar para formatear fechas a DD/MM/AAAA
function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  // Si ya viene formateada tipo DD/MM/AAAA la dejamos
  if (fechaStr.includes('/')) return fechaStr;
  const partes = fechaStr.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaStr;
}

/**
 * Genera el documento PDF completo a partir de los datos de la orden
 * @param {Object} data - Objeto con todos los campos de la orden
 * @returns {Promise<Uint8Array>} Bytes del PDF generado
 */
async function generarOrdenPdfBytes(data) {
  if (typeof PDFLib === 'undefined') {
    throw new Error('La librería PDFLib no está cargada.');
  }
  if (typeof TEMPLATE_PDF_BASE64 === 'undefined') {
    throw new Error('La plantilla base PDF no está cargada.');
  }

  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  // Cargar la plantilla original desde Base64
  const templateBytes = base64ToUint8Array(TEMPLATE_PDF_BASE64);
  const pdfDoc = await PDFDocument.load(templateBytes);

  // Cargar fuentes estándar Helvetica
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const page = pages[0];
  const colorNegro = rgb(0, 0, 0);

  // Función para dibujar texto
  function drawText(text, x, y, size = 10, isBold = false) {
    if (!text && text !== 0) return;
    const font = isBold ? helveticaBold : helveticaFont;
    page.drawText(String(text), {
      x: Number(x),
      y: Number(y),
      size: Number(size),
      font: font,
      color: colorNegro,
    });
  }

  // Función para dibujar marca de verificación (X) en casilla
  function drawCheck(condition, x, y, size = 12) {
    if (condition) {
      page.drawText('X', {
        x: Number(x),
        y: Number(y),
        size: Number(size),
        font: helveticaBold,
        color: colorNegro,
      });
    }
  }

  // 1. CABECERA
  drawText(formatearFecha(data.fecha), 465, 764.4, 10, true);
  drawText(formatearFecha(data.fechaEntrega), 505, 739.5, 10, true);

  // 2. CLIENTE Y DATOS DE CONTACTO (Izquierda superior)
  drawText(data.cliente, 81.5, 709.4, 11, true);
  drawText(data.attn, 69.5, 661.4, 10, false);
  drawText(data.entrega, 75.0, 634.1, 10, false);
  drawText(data.tel, 50.0, 607.1, 10, false);
  drawText(data.poblacion, 250.0, 607.1, 10, false);

  // 3. DATOS ADMINISTRATIVOS Y PRECIO (Derecha superior)
  drawText(data.presupuestoNo, 385.0, 709.5, 10, false);
  drawText(data.pedidoNo, 495.0, 709.5, 10, false);
  drawText(data.albaranNo, 360.0, 665.8, 10, false);
  drawText(data.facturaNo, 483.9, 660.8, 11, true);
  
  if (data.observacionesTop) {
    drawText(data.observacionesTop, 310.0, 620.0, 8.5, false);
  }

  // PRECIO (caja destacada debajo de PRECIO)
  if (data.precio) {
    let precioStr = String(data.precio).trim();
    if (!precioStr.includes('€') && !isNaN(precioStr.replace(',', '.'))) {
      precioStr += ' €';
    }
    drawText(precioStr, 502.7, 608.2, 13.5, true);
  }

  // 4. DESCRIPCIÓN TRABAJO REALIZADO (Centro izquierda)
  drawText(data.descCantidad, 52.8, 547.0, 11, true);
  drawText(data.descLinea1, 88.8, 550.6, 10.5, true);
  drawText(data.descLinea2, 30.8, 524.4, 10.5, true);
  drawText(data.descLinea3, 30.8, 500.0, 10.5, true);
  drawText(data.descLinea4, 30.8, 480.0, 10.5, true);

  // Medida final, Tinta, Numerado
  drawText(data.medidaFinal, 93.0, 463.3, 10.5, true);
  drawText(data.tinta, 62.2, 434.6, 10.5, true);
  drawText(data.numerado, 180.0, 434.6, 10, false);

  // Papel y gramaje
  drawText(data.papel, 75.8, 409.5, 10.5, true);
  drawText(data.gramaje, 69.0, 359.8, 10, true);
  drawText(data.medidaPapel, 165.0, 359.8, 10, false);
  drawCheck(data.pedidoPapelCheck, 205.0, 359.8, 11);
  drawText(data.pedidoPapel, 250.0, 359.8, 10, false);

  // Copiativo (CB, CFB, CF)
  drawCheck(data.cbCheck, 24.6, 319.2, 11);
  drawText(data.cbTexto, 57.0, 319.1, 10, false);

  drawCheck(data.cfbTopCheck, 118.1, 336.0, 11);
  drawText(data.cfbTopTexto, 153.6, 336.0, 10, false);

  drawCheck(data.cfbBotCheck, 118.1, 320.2, 11);
  drawText(data.cfbBotTexto, 153.6, 318.7, 10, false);

  drawCheck(data.cfCheck, 213.2, 320.7, 11);
  drawText(data.cfTexto, 245.1, 320.2, 10, false);

  // 5. REPETICIÓN TRABAJO / NÚMEROS P y G (Centro derecha)
  drawText(formatearFecha(data.fecha_repeticion), 485.0, 579.0, 9, false);

  // Ranura superior (Repetición previa)
  drawText(data.numeroP_arriba, 383.1, 551.1, 12, true);
  drawText(data.existencia_arriba, 505.0, 551.1, 10, false);
  drawText(data.numeroG_arriba, 390.4, 529.1, 12, true);

  // Ranura inferior (Trabajo actual)
  drawText(data.numeroP_abajo, 376.3, 504.6, 12, true);
  drawText(data.existencia_abajo, 505.0, 504.6, 10, false);
  drawText(data.numeroG_abajo, 389.8, 479.5, 12, true);

  // Proveedores externos / Compo
  drawCheck(data.tipografiaCheck, 308.3, 458.3, 11);
  drawText(data.tipografiaNum, 385.0, 458.3, 9, false);

  drawCheck(data.exaprintCheck, 448.0, 458.5, 11);
  drawText(data.exaprintNum, 530.0, 458.5, 9, false);

  drawCheck(data.impresplaCheck, 308.3, 421.0, 11);
  drawText(data.impresplaNum, 395.0, 421.0, 9, false);

  drawCheck(data.truyolCheck, 448.0, 427.8, 11);
  drawText(data.truyolNum, 525.0, 427.8, 9, false);

  drawCheck(data.grafixCheck, 308.3, 396.9, 11);
  drawText(data.grafixNum, 380.0, 396.9, 9, false);

  drawCheck(data.arponCheck, 448.0, 395.8, 11);
  drawText(data.arponNum, 525.0, 395.8, 9, false);

  drawCheck(data.compoCheck, 308.3, 361.7, 11);
  drawCheck(data.compo45x32, 358.0, 374.2, 10);
  drawCheck(data.compo48x33, 358.0, 359.5, 10);
  drawCheck(data.compo48x32_5, 358.0, 345.4, 10);
  drawText(data.hojas, 445.0, 362.4, 9, false);

  drawCheck(data.otroCheck, 308.3, 321.4, 11);
  drawText(data.otroTexto, 365.0, 321.4, 9, false);

  drawCheck(data.pedidoProvCheck, 465.0, 329.9, 11);
  drawText(data.pedidoProvNum, 505.0, 329.9, 10, true);

  // 6. ACABADOS
  drawCheck(data.hendido, 24.5, 257.4, 11);
  drawCheck(data.doblado, 95.0, 257.4, 11);
  drawCheck(data.cosido, 167.0, 257.4, 11);

  drawCheck(data.talonarios, 222.1, 283.5, 11);
  drawCheck(data.encolado, 223.0, 269.3, 11);
  drawCheck(data.cabeza, 300.0, 262.7, 11);
  drawCheck(data.lomo, 300.0, 248.9, 11);
  drawCheck(data.taladro, 223.1, 242.9, 11);

  drawCheck(data.plastificado, 362.0, 289.9, 11);
  drawCheck(data.brillo, 376.0, 271.6, 11);
  drawCheck(data.mate, 376.0, 249.3, 11);

  drawCheck(data.otrosAcabadosCheck, 455.0, 286.3, 11);
  drawText(data.otrosAcabadosTexto, 510.0, 286.3, 9, false);

  // 7. OBSERVACIONES (Caja inferior grande)
  if (data.observaciones) {
    const lineas = String(data.observaciones).split('\n');
    let startY = 202.0;
    for (let i = 0; i < Math.min(lineas.length, 12); i++) {
      drawText(lineas[i], 22.0, startY - (i * 14.0), 9.5, false);
    }
  }

  return await pdfDoc.save();
}

/**
 * Genera el nombre de archivo sugerido para guardar el PDF
 */
function generarNombrePdf(data) {
  const p = (data.numeroP_abajo || data.numeroP_arriba || 'ORDEN').toString().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cliente = (data.cliente || 'CLIENTE').toString().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ORDEN_${p}_${cliente}.pdf`;
}

/**
 * Descarga directamente el PDF en el navegador
 */
async function descargarPdf(data) {
  try {
    const pdfBytes = await generarOrdenPdfBytes(data);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generarNombrePdf(data);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('Error al descargar PDF:', err);
    alert('Error al generar el PDF: ' + err.message);
  }
}

/**
 * Abre el cuadro de diálogo de impresión nativa del PDF
 */
async function imprimirPdfDirecto(data) {
  try {
    const pdfBytes = await generarOrdenPdfBytes(data);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Creamos un iframe oculto para imprimir sin salir de la página
    let iframe = document.getElementById('pdfPrintIframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'pdfPrintIframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    iframe.onload = function() {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          // Si el navegador bloquea la impresión por iframe, abrir en nueva pestaña
          window.open(url, '_blank');
        }
      }, 300);
    };

    iframe.src = url;
  } catch (err) {
    console.error('Error al imprimir PDF:', err);
    alert('Error al generar el PDF para imprimir: ' + err.message);
  }
}
