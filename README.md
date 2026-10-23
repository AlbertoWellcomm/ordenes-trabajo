# Gestor de Órdenes de Trabajo - Impremta Comercial 1940

Aplicación web para la gestión, repetición y generación de órdenes de trabajo para imprenta en formato PDF idéntico al modelo oficial A4.

## 🚀 Características
- **Generación de PDF**: Estampado fiel en PDF idéntico a la plantilla original A4 mediante `pdf-lib`.
- **Regla de Repetición de Trabajo**: Duplica una orden existente dejando el presupuesto en blanco, moviendo los números de taller (P y G) inferiores a los superiores, y dejando los inferiores en blanco para la nueva tirada.
- **Búsqueda y Filtros**: Búsqueda por cliente (con autocompletado), rango de fechas y buscador general.
- **Sincronización en la Nube Gratuita**: Integración en tiempo real con Google Firebase Firestore para sincronizar datos entre múltiples ordenadores.
- **Privacidad y Seguridad**: Base de datos protegida mediante Firebase Authentication. Las órdenes solo son visibles para usuarios autorizados.

## 🌐 GitHub Pages
Esta aplicación es 100% estática (HTML, CSS y JavaScript vainilla) y se ejecuta directamente en GitHub Pages sin necesidad de servidor adicional.
