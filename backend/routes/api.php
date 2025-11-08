<?php
// backend/routes/api.php

/* =========================
   CORS
   (habilita localhost:3000 y tu dominio; si querés, dejá '*')
========================= */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://rhnegativo.3devsnet.com',
];
$allowOrigin = in_array($origin, $allowed, true) ? $origin : '*';

header("Access-Control-Allow-Origin: $allowOrigin");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Evitar que warnings/notice rompan el JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

/* =========================
   DB (una sola vez)
========================= */
require_once __DIR__ . '/../config/db.php';

/* =========================
   Router por acción
========================= */
$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        /* =========================
           LOGIN / REGISTRO / SOCIOS
        ========================= */
        case 'inicio':
            require_once __DIR__ . '/../modules/login/inicio.php';
            exit;

        case 'registro':
            require_once __DIR__ . '/../modules/login/registro.php';
            exit;

        case 'socios':
            require_once __DIR__ . '/../modules/socios/obtener_socios.php';
            exit;

        case 'agregar_socio':
            require_once __DIR__ . '/../modules/socios/agregar_socio.php';
            exit;

        case 'eliminar_socio':
            require_once __DIR__ . '/../modules/socios/eliminar_socio.php';
            exit;

        case 'editar_socio':
            require_once __DIR__ . '/../modules/socios/editar_socio.php';
            exit;

        case 'next_id_socio':
            require_once __DIR__ . '/../modules/socios/next_id_socio.php';
            exit;

        case 'listas':
            require_once __DIR__ . '/../modules/global/obtener_listas.php';
            exit;

        case 'dar_baja_socio':
            require_once __DIR__ . '/../modules/socios/dar_baja_socio.php';
            exit;

        case 'dar_alta_socio':
            require_once __DIR__ . '/../modules/socios/dar_alta_socio.php';
            exit;

        /* =========================
           FAMILIAS (archivos separados)
        ========================= */
        case 'familias_listar':
            require_once __DIR__ . '/../modules/socios/familias/familias_listar.php';
            exit;

        case 'familia_agregar':
            require_once __DIR__ . '/../modules/socios/familias/agregar_familia.php';
            exit;

        case 'familia_editar':
            require_once __DIR__ . '/../modules/socios/familias/editar_familia.php';
            exit;

        case 'familia_eliminar':
            require_once __DIR__ . '/../modules/socios/familias/eliminar_familia.php';
            exit;

        case 'familia_miembros':
            require_once __DIR__ . '/../modules/socios/familias/familia_miembros.php';
            exit;

        case 'socios_sin_familia':
            require_once __DIR__ . '/../modules/socios/familias/socios_sin_familia.php';
            exit;

        case 'familia_agregar_miembros':
            require_once __DIR__ . '/../modules/socios/familias/familia_agregar_miembros.php';
            exit;

        case 'familia_quitar_miembro':
            require_once __DIR__ . '/../modules/socios/familias/familia_quitar_miembro.php';
            exit;

        // Compatibilidad con tu frontend actual (POST familia_guardar)
        // El archivo detecta si viene id_familia para decidir INSERT/UPDATE.
        case 'familia_guardar':
            require_once __DIR__ . '/../modules/socios/familias/familia_guardar.php';
            exit;

        /* =========================
                  CUOTAS
        ========================= */
        case 'cuotas':
            require_once __DIR__ . '/../modules/cuotas/cuotas.php';
            exit;

        case 'registrar_pago':
            require_once __DIR__ . '/../modules/cuotas/registrar_pago.php';
            exit;

        case 'periodos_pagados':
            require_once __DIR__ . '/../modules/cuotas/obtener_periodos_pagados.php';
            exit;

        case 'socio_comprobante':
            require_once __DIR__ . '/../modules/cuotas/obtener_socio_comprobante.php';
            exit;

        case 'buscar_socio_codigo':
            require_once __DIR__ . '/../modules/cuotas/buscar_socio_codigo.php';
            exit;

        case 'eliminar_pago':
            require_once __DIR__ . '/../modules/cuotas/eliminar_pago.php';
            exit;

        case 'estado_periodo_socio':
            require_once __DIR__ . '/../modules/cuotas/estado_periodo_socio.php';
            exit;

        case 'montos':
            require_once __DIR__ . '/../modules/cuotas/montos.php';
            exit;

        /* =========================
                CATEGORÍAS
           (sin prefijo de DB)
        ========================= */
        case 'categorias_listar':
            require_once __DIR__ . '/../modules/categorias/categorias_listar.php';
            exit;

        case 'categorias_guardar':
            require_once __DIR__ . '/../modules/categorias/categorias_guardar.php';
            exit;

        case 'categorias_actualizar':
            require_once __DIR__ . '/../modules/categorias/categorias_actualizar.php';
            exit;

        case 'categorias_eliminar':
            require_once __DIR__ . '/../modules/categorias/categorias_eliminar.php';
            exit;

        case 'categorias_historial':
            require_once __DIR__ . '/../modules/categorias/categorias_historial.php';
            exit;

        /* =========================
                CONTABLE
        ========================= */
        case 'contable':
            require_once __DIR__ . '/../modules/contable/contable_socios.php';
            exit;

        case 'obtener_monto_objetivo':
            require_once __DIR__ . '/../modules/contable/obtener_monto_objetivo.php';
            exit;

        case 'contar_socios_por_cat_estado':
            require_once __DIR__ . '/../modules/contable/contar_socios_por_cat_estado.php';
            exit;


        /* =========================
               DEFAULT / 404
        ========================= */
        default:
            http_response_code(404);
            echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida: ' . $action]);
            exit;
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'mensaje' => 'Error en router',
        // Descomentar para depurar:
        // 'error' => $e->getMessage(),
    ]);
    exit;
}
