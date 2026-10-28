# ☁️ Guía de Sincronización Gratuita en la Nube (Firebase)
## Gestor de Órdenes de Trabajo - Impremta Comercial 1940

Esta aplicación web funciona inmediatamente en cualquier ordenador en **Modo Local**, pero gracias a **Google Firebase Firestore (Plan Gratuito Spark)** puedes sincronizar automáticamente todos los datos entre tus **2 o 3 ordenadores** (oficina, taller, casa o portátil) sin pagar nada y sin necesidad de configurar redes locales.

---

## 🚀 Pasos para la configuración (Sólo se hace 1 vez - 2 minutos)

### 1. Entrar en Google Firebase
1. Abre tu navegador y entra en: **[https://console.firebase.google.com](https://console.firebase.google.com)**
2. Inicia sesión con cualquier cuenta gratuita de Google (Gmail).

### 2. Crear un Proyecto Gratuito
1. Haz clic en **"Crear un proyecto"** (o "Añadir proyecto").
2. Ponle un nombre, por ejemplo: `imprenta-ordenes`.
3. Desactiva Google Analytics (no es necesario) y pulsa **Crear proyecto**.

### 3. Activar la Base de Datos (Firestore Database)
1. En el menú lateral izquierdo, haz clic en **Compilación** > **Firestore Database**.
2. Haz clic en **"Crear base de datos"**.
3. Elige la ubicación (por ejemplo `europe-west` o la recomendada) y pulsa Siguiente.
4. Selecciona **"Iniciar en modo de prueba"** (para que tus ordenadores puedan leer y escribir sin pedir contraseña) y pulsa **Habilitar**.

### 4. Obtener la Configuración Web
1. En la parte superior del menú izquierdo, pulsa en el icono de engranaje ⚙️ (**Configuración del proyecto**).
2. Baja hasta la sección **"Tus apps"** y haz clic en el icono Web **`</>`**.
3. Ponle un apodo a la app (ej: `web-imprenta`) y haz clic en **Registrar app**.
4. Te mostrará un código similar a este:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxx",
  authDomain: "imprenta-ordenes.firebaseapp.com",
  projectId: "imprenta-ordenes",
  storageBucket: "imprenta-ordenes.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

5. Copia ese bloque de texto.

---

## 💻 Conectar los 2 o 3 Ordenadores

En cada uno de los 2 o 3 ordenadores:

1. Abre el programa haciendo doble clic en **`Abrir_Aplicacion.bat`** (o abre `index.html` en Chrome o Edge).
2. En la barra superior, haz clic en el botón **`☁️ Nube`** (o en la insignia "Modo Local").
3. Pega el código que copiaste en el cuadro de texto.
4. Pulsa el botón **"🔍 Probar Conexión"**. Verás el mensaje *"¡Conexión establecida con éxito!"*.
5. Pulsa **"💾 Guardar y Conectar"**.
6. En el primer ordenador donde tengas datos guardados, puedes pulsar **"⬆️ Subir Locales a Nube"** para que tus órdenes existentes se suban inmediatamente.

**¡Listo!** A partir de ese instante:
- La insignia superior se pondrá en verde: 🟢 **Nube Conectada**.
- Cada orden que crees, modifiques o repitas se sincronizará automáticamente en tiempo real entre los 2 o 3 ordenadores.
- No importa si un ordenador está en el taller, en la oficina o en casa: mientras tenga conexión a internet, los datos estarán siempre actualizados.

---

## 🔒 Privacidad y Protección de Datos (Autenticación Obligatoria)

Para que los datos de tus clientes, órdenes y presupuestos sean **100% privados** y nadie en internet pueda acceder a ellos sin tu permiso:

### 1. Activar inicio de sesión en Firebase (Solo 1 minuto)
1. En tu consola de Firebase ([console.firebase.google.com](https://console.firebase.google.com)):
2. En el menú de la izquierda, haz clic en **Compilación** > **Authentication**.
3. Haz clic en el botón **"Comenzar"**.
4. En la pestaña **Método de acceso** (Sign-in method):
   - Haz clic en **Correo electrónico/Contraseña**.
   - Activa el primer interruptor (**Habilitar**) y pulsa **Guardar**.

### 2. Bloquear la base de datos para accesos no autorizados
1. En el menú de la izquierda, entra en **Firestore Database**.
2. Arriba, haz clic en la segunda pestaña llamada **"Reglas"** (Rules).
3. Sustituye el texto que haya por este código de máxima seguridad:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Haz clic en el botón azul **"Publicar"**.

### 3. Crear tu usuario en la aplicación web
1. En tu aplicación web, haz clic en la barra superior en **`🔒 Iniciar Sesión`**.
2. Escribe tu correo electrónico y la contraseña que tú elijas (mínimo 6 caracteres).
3. Pulsa el botón **"Registrar nuevo usuario en Firebase"**.
4. ¡Listo! La barra superior mostrará tu usuario con el icono **`👤`**.
5. En tus otros 1 o 2 ordenadores, simplemente pulsa **`🔒 Iniciar Sesión`**, pon ese mismo correo y contraseña y pulsa **"🔑 Iniciar Sesión"**. Quedará recordado automáticamente.
Aunque la nube guarda todo en los servidores de Google, siempre tienes a mano en la barra superior los botones:
- **💾 Exportar**: Abre una ventana para elegir el **nombre personalizado** que desees para el archivo y guardarlo en la carpeta que elijas (Escritorio, Pendrive, etc.).
- **📂 Importar**: Restaura o añade órdenes desde un archivo `.json` con un solo clic.

---

## 🔄 Funcionamiento de "Repetición de Trabajo"
Siguiendo las especificaciones de tu imprenta:
- Al pulsar **🔄 Repetir** en cualquier orden existente:
  1. Se copian todos los datos del trabajo (cliente, medidas, tintas, papeles, acabados, etc.).
  2. El campo **Presupuesto Nº** queda **en blanco** (salvo presupuesto).
  3. Los valores de **Número P** y **Número G** de **abajo** se copian a los campos de **arriba** (historial de repetición).
  4. Los campos de **abajo** quedan **en blanco** para asignar la nueva numeración del taller.
  5. Se asigna la fecha actual automáticamente.
