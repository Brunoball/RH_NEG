<?php
// CORS global para permitir solicitudes desde el frontend
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Manejo de preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Acción solicitada
$action = $_GET['action'] ?? '';

switch ($action) {
    /* =========================
       LOGIN / REGISTRO / SOCIOS
    ========================= */
    case 'inicio':
        require_once __DIR__ . '/../modules/login/inicio.php';
        break;

    case 'registro':
        require_once __DIR__ . '/../modules/login/registro.php';
        break;

    case 'socios':
        require_once __DIR__ . '/../modules/socios/obtener_socios.php';
        break;

    case 'agregar_socio':
        require_once __DIR__ . '/../modules/socios/agregar_socio.php';
        break;

    case 'eliminar_socio':
        require_once __DIR__ . '/../modules/socios/eliminar_socio.php';
        break;

    case 'editar_socio':
        require_once __DIR__ . '/../modules/socios/editar_socio.php';
        break;

    case 'next_id_socio':
        require_once __DIR__ . '/../modules/socios/next_id_socio.php';
        break;

    case 'listas':
        require_once __DIR__ . '/../modules/global/obtener_listas.php';
        break;

    case 'dar_baja_socio':
        require_once __DIR__ . '/../modules/socios/dar_baja_socio.php';
        break;

    case 'dar_alta_socio':
        require_once __DIR__ . '/../modules/socios/dar_alta_socio.php';
        break;

    /* =========================
              CUOTAS
    ========================= */
    case 'cuotas':
        require_once __DIR__ . '/../modules/cuotas/cuotas.php';
        break;

    case 'registrar_pago':
        require_once __DIR__ . '/../modules/cuotas/registrar_pago.php';
        break;

    case 'periodos_pagados':
        require_once __DIR__ . '/../modules/cuotas/obtener_periodos_pagados.php';
        break;

    case 'socio_comprobante':
        require_once __DIR__ . '/../modules/cuotas/obtener_socio_comprobante.php';
        break;

    case 'buscar_socio_codigo':
        require_once __DIR__ . '/../modules/cuotas/buscar_socio_codigo.php';
        break;

    case 'eliminar_pago':
        require_once __DIR__ . '/../modules/cuotas/eliminar_pago.php';
        break;

    case 'estado_periodo_socio':
        require_once __DIR__ . '/../modules/cuotas/estado_periodo_socio.php';
        break;

    case 'montos':
        // ⬅️ RUTA CORRECTA (antes estaba mal)
        require_once __DIR__ . '/../modules/cuotas/montos.php';
        break;
        

    /* =========================
             CONTABLE
    ========================= */
    case 'contable':
        require_once __DIR__ . '/../modules/contable/contable_socios.php';
        break;

    /* =========================
            CATEGORÍAS (NUEVO)
       Tabla: rh_neg.categoria_monto
    ========================= */
    case 'categorias_listar':
        require_once __DIR__ . '/../modules/categorias/categorias_listar.php';
        break;

    case 'categorias_guardar':
        require_once __DIR__ . '/../modules/categorias/categorias_guardar.php';
        break;

    case 'categorias_actualizar':
        require_once __DIR__ . '/../modules/categorias/categorias_actualizar.php';
        break;

    case 'categorias_eliminar':
        require_once __DIR__ . '/../modules/categorias/categorias_eliminar.php';
        break;

    case 'categorias_historial':
        require_once __DIR__ . '/../modules/categorias/categorias_historial.php';
        break;


    default:
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
        break;
}
