# DeCasa

Aplicación para crear tiendas online de afiliación Amazon con ganancias recurrentes — sin manipular productos ni envíos.

## Funcionalidades

### Dashboard de control
- Estadísticas de beneficios por día, semana y mes
- Gráficas de evolución de ingresos y clics
- Top productos por beneficio generado
- Resumen de ventas recientes

### Buscador de productos Amazon
- Conector real con la Product Advertising API (PA-API 5)
- Modo demostración con productos de ejemplo para probar sin credenciales
- Filtrado por categoría y ordenación por reseñas, valoraciones y precio
- **Botón "Aceptar y subir"**: tras revisar los artículos, el administrador decide cuáles subir a su tienda

### Tiendas online
- Crear múltiples tiendas con nombres y slugs diferentes
- Modo **automático** o **manual**
- **Botón "Subir / Actualizar"**: publica productos en tu tienda de forma totalmente automática
- **Publicación en una web real** (botón "📤 Publicar en web real"): sube tu tienda, como página web estática, a tu hosting o servidor vía **FTP, FTPS o SFTP** (formulario de configuración con host, puerto, usuario, contraseña, protocolo y ruta remota)
  - Cada pulso del botón vuelve a generar y subir la web con los productos más nuevos
  - Incluye botón de **"Probar conexión"** en el panel de configuración
  - Muestras una **vista previa estática** de lo que se subirá a internet
- Definición de formato de tienda (cuadrícula, lista, carrusel, mosaico)
- Vistas públicas de tienda en `localhost:4000/tienda/<slug>`

### Cuentas de afiliado de Amazon
- Registro de múltiples cuentas y mercados (amazon.es, .com, .co.uk, etc.)
- Enlace directo para registrarse en Amazon Associates
- Tracking ID y marketplace por cuenta

### Cobro de beneficios
- Saldo disponible, pendiente y cobrado
- **Botón de cobro** con selección de método de pago
- Solicitud de cobro con importe a elegir y métodos configurables
- Registro manual de ventas para tracking de beneficios

### Panel de control / Ajustes
- Configuración de credenciales de Amazon PA-API
- Modo demostración activable/desactivable
- Métodos de pago (PayPal, transferencia, cripto, tarjeta, cheque)
- Ajustes generales: moneda, comisión por defecto, subida automática

## Instalación

### Opción 1 · Linux (.deb) — recomendada

Descarga el paquete en la **release** de GitHub: https://github.com/JMBermejias/DeCasa/releases

```bash
sudo dpkg -i decasa_1.2.0_amd64.deb
decasa          # abre la app en el navegador
decasa start    # inicia el servidor
decasa stop     # lo detiene
decasa status   # estado
```

El paquete es **autónomo** (incluye el runtime de Node.js), inicia el servidor en `http://localhost:4000`,
se lanza al iniciar sesión y también puede ejecutarse como servicio de usuario:

```bash
systemctl --user enable --now decasa
```

Los datos (base de datos SQLite y logs) se guardan en `~/.local/share/decasa/` y pueden
reubicarse con la variable de entorno `DECASA_DATA_DIR`.

### Opción 2 · Android (.apk)

Descarga `DeCasa.apk` de la release e instálalo en tu móvil. La app abre el panel de DeCasa y permite
configurar la URL de tu servidor (local o remoto).

### Opción 3 · Código fuente (cualquier plataforma: Windows, macOS, Linux)

```bash
cd DeCasa

# Instalar dependencias de root, server y client
npm run install:all

# Desarrollo (servidor + cliente en paralelo)
npm run dev

# Producción
npm start
```

- **Servidor API**: `http://localhost:4000`
- **Frontend (desarrollo)**: `http://localhost:5173` (proxy automático al servidor en 4000)
- **App completa**: `http://localhost:4000` (una vez compilado)

### Reconstruir los paquetes

```bash
./build/deb/build-deb.sh                      # genera dist/deb/decasa_*.deb
./build/android/build-apk.sh                  # genera el .apk firmado
```

> En entornos sin `dpkg-deb` también puedes usar `python3 build/build-deb-py.py`.

## Modo demostración

Por defecto, la aplicación funciona en modo demostración. Busca productos de ejemplo con
reseñas simuladas. Para usar productos reales de Amazon, introduce tus credenciales de la
**Product Advertising API (PA-API)** y tu **Partner Tag** (ID de afiliado) en el Panel de control.

## Stack tecnológico

- **Backend**: Node.js, Express, better-sqlite3
- **Frontend**: React 18, React Router 6, Recharts, Vite
- **Base de datos**: SQLite (archivos en `~/.local/share/decasa/` o `$DECASA_DATA_DIR`)
- **Integración Amazon**: PA-API 5 con firma AWS Signature Version 4

## Licencia

MIT
