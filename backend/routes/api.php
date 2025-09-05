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
    case 'inicio':
        require_once(__DIR__ . '/../modules/login/inicio.php');
        break;

    case 'registro':
        require_once(__DIR__ . '/../modules/login/registro.php');
        break;

    case 'socios':
        require_once(__DIR__ . '/../modules/socios/obtener_socios.php');
        break;

    case 'agregar_socio':
        require_once(__DIR__ . '/../modules/socios/agregar_socio.php');
        break;

    case 'eliminar_socio':
        require_once(__DIR__ . '/../modules/socios/eliminar_socio.php');
        break;

    case 'editar_socio':
        require_once(__DIR__ . '/../modules/socios/editar_socio.php');
        break;

    case 'next_id_socio':
        require_once __DIR__ . '/../modules/socios/next_id_socio.php';
        break;


    case 'listas':
        require_once(__DIR__ . '/../modules/global/obtener_listas.php');
        break;

    case 'dar_baja_socio':
        require_once(__DIR__ . '/../modules/socios/dar_baja_socio.php');
        break;

    case 'dar_alta_socio': 
        require_once(__DIR__ . '/../modules/socios/dar_alta_socio.php');
        break;

    case 'cuotas':
        require_once(__DIR__ . '/../modules/cuotas/cuotas.php');
        break;

    case 'registrar_pago':
        require_once(__DIR__ . '/../modules/cuotas/registrar_pago.php');
        break;

    case 'periodos_pagados':
        require_once(__DIR__ . '/../modules/cuotas/obtener_periodos_pagados.php');
        break;

    case 'socio_comprobante':
        require_once(__DIR__ . '/../modules/cuotas/obtener_socio_comprobante.php');
        break;

    case 'buscar_socio_codigo':
        require_once(__DIR__ . '/../modules/cuotas/buscar_socio_codigo.php');
        break;

    case 'eliminar_pago':
        require_once(__DIR__ . '/../modules/cuotas/eliminar_pago.php');
        break;

    case 'estado_periodo_socio':
        require_once(__DIR__ . '/../modules/cuotas/estado_periodo_socio.php');
        break;



    // === NUEVOS CASOS PARA EL PANEL CONTABLE ===
    case 'contable':
        // Endpoint NUEVO que agrupa pagos por periodo y aplica descuento 6x
        require_once(__DIR__ . '/../modules/contable/contable_socios.php');
        break;



    default:
        echo json_encode(['exito' => false, 'mensaje' => 'Acción no válida.']);
        break;
}
