<?php
// CORS global

header("Access-Control-Allow-Origin: http://localhost:3001");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'inicio':
        require_once(__DIR__ . '/modules/login/inicio.php');
        break;

    case 'registro':
        require_once(__DIR__ . '/modules/login/registro.php');
        break;

    case 'socios':
        require_once(__DIR__ . '/modules/socios/obtener_socios.php');
        break;

    case 'agregar_socio':
        require_once(__DIR__ . '/modules/socios/agregar_socio.php');
        break;

    case 'eliminar_socio':
        require_once(__DIR__ . '/modules/socios/eliminar_socio.php');
        break;

    case 'editar_socio':
        require_once(__DIR__ . '/modules/socios/editar_socio.php');
        break;

    case 'listas':
        require_once(__DIR__ . '/modules/global/obtener_listas.php');
        break;

    case 'dar_baja_socio':
        require_once(__DIR__ . '/modules/socios/dar_baja_socio.php');
        break;

    case 'dar_alta_socio': 
        require_once(__DIR__ . '/modules/socios/dar_alta_socio.php');
        break;

    default:
        echo json_encode(['exito' => false, 'mensaje' => 'Acción no válida.']);
        break;
}
