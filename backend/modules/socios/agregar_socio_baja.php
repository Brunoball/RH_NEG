<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error de conexión: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

function aMayusBaja($texto) {
    return isset($texto) && trim((string)$texto) !== '' ? mb_strtoupper(trim((string)$texto), 'UTF-8') : null;
}

function collapse_spaces_baja($s) {
    if ($s === null) return null;
    return preg_replace('/\s+/u', ' ', $s);
}

function responderErrorBaja($errores) {
    echo json_encode(['exito' => false, 'errores' => $errores], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !is_array($data)) {
        responderErrorBaja(['general' => '❌ Datos no válidos o vacíos.']);
    }

    $apellido = collapse_spaces_baja(aMayusBaja($data['apellido'] ?? ''));
    $nombres  = collapse_spaces_baja(aMayusBaja($data['nombres'] ?? ''));

    if (!$apellido || trim($apellido) === '') {
        responderErrorBaja(['apellido' => '⚠️ El apellido es obligatorio.']);
    }
    if (!$nombres || trim($nombres) === '') {
        responderErrorBaja(['nombres' => '⚠️ El nombre es obligatorio.']);
    }

    if (!preg_match('/^[\p{L}\s]+$/u', $apellido) || mb_strlen($apellido, 'UTF-8') > 100) {
        responderErrorBaja(['apellido' => '❌ Solo letras y espacios. Máximo 100 caracteres.']);
    }
    if (!preg_match('/^[\p{L}\s]+$/u', $nombres) || mb_strlen($nombres, 'UTF-8') > 100) {
        responderErrorBaja(['nombres' => '❌ Solo letras y espacios. Máximo 100 caracteres.']);
    }

    $nombre = collapse_spaces_baja(trim($apellido . ' ' . $nombres));
    if (mb_strlen($nombre, 'UTF-8') > 100) {
        $nombre = mb_substr($nombre, 0, 100, 'UTF-8');
    }

    $id_cobrador     = is_numeric($data['id_cobrador'] ?? null) ? (int)$data['id_cobrador'] : null;
    $id_categoria    = is_numeric($data['id_categoria'] ?? null) ? (int)$data['id_categoria'] : null;
    $id_cat_monto    = is_numeric($data['id_cat_monto'] ?? null) ? (int)$data['id_cat_monto'] : null;
    $id_estado       = is_numeric($data['id_estado'] ?? null) ? (int)$data['id_estado'] : null;

    $domicilio       = aMayusBaja($data['domicilio'] ?? '');
    $numero          = trim((string)($data['numero'] ?? ''));
    $telefono_movil  = trim((string)($data['telefono_movil'] ?? ''));
    $telefono_fijo   = trim((string)($data['telefono_fijo'] ?? ''));
    $comentario      = aMayusBaja($data['comentario'] ?? '');
    $nacimiento      = !empty($data['nacimiento']) ? trim((string)$data['nacimiento']) : null;
    $domicilio_cobro = $data['domicilio_cobro'] ?? '';
    $dni             = trim((string)($data['dni'] ?? ''));
    $fecha_baja      = !empty($data['fecha_baja']) ? trim((string)$data['fecha_baja']) : date('Y-m-d');
    $motivo          = aMayusBaja($data['motivo'] ?? '');

    $errores = [];

    if ($id_cobrador === null)  $errores['id_cobrador'] = '⚠️ Debés seleccionar el método de pago.';
    if ($id_categoria === null) $errores['id_categoria'] = '⚠️ Debés seleccionar el tipo de sangre.';
    if ($id_cat_monto === null) $errores['id_cat_monto'] = '⚠️ Debés seleccionar la categoría (cuota).';
    if ($id_estado === null)    $errores['id_estado'] = '⚠️ Debés seleccionar el estado.';

    if ($domicilio === null || trim($domicilio) === '') $errores['domicilio'] = '⚠️ El domicilio es obligatorio.';
    if ($numero === '') $errores['numero'] = '⚠️ El número es obligatorio.';
    if ($dni === '') $errores['dni'] = '⚠️ El DNI es obligatorio.';
    if ($nacimiento === null) $errores['nacimiento'] = '⚠️ La fecha de nacimiento es obligatoria.';
    if ($fecha_baja === '') $errores['fecha_baja'] = '⚠️ La fecha de baja es obligatoria.';

    if (!empty($errores)) {
        responderErrorBaja($errores);
    }

    if (!empty($domicilio) && (!preg_match('/^[\p{L}\p{N}\s.,-]+$/u', $domicilio) || mb_strlen($domicilio, 'UTF-8') > 100)) {
        responderErrorBaja(['domicilio' => '❌ Domicilio inválido. Letras/números, espacios y . , -. Máximo 100 caracteres.']);
    }
    if (!empty($domicilio_cobro) && mb_strlen((string)$domicilio_cobro, 'UTF-8') > 150) {
        responderErrorBaja(['domicilio_cobro' => '❌ Máximo 150 caracteres.']);
    }
    if (!empty($comentario) && (!preg_match('/^[\p{L}\p{N}\s.,-]+$/u', $comentario) || mb_strlen($comentario, 'UTF-8') > 1000)) {
        responderErrorBaja(['comentario' => '❌ Comentario inválido. Letras/números, espacios y . , -. Máximo 1000 caracteres.']);
    }
    if (!empty($motivo) && (!preg_match('/^[\p{L}\p{N}\s.,-]+$/u', $motivo) || mb_strlen($motivo, 'UTF-8') > 1000)) {
        responderErrorBaja(['motivo' => '❌ Motivo inválido. Letras/números, espacios y . , -. Máximo 1000 caracteres.']);
    }
    if (!empty($numero) && (!preg_match('/^[0-9]+$/', $numero) || strlen($numero) > 20)) {
        responderErrorBaja(['numero' => '❌ Solo números. Máximo 20 caracteres.']);
    }
    if (!empty($telefono_movil) && (!preg_match('/^[0-9\-]+$/', $telefono_movil) || strlen($telefono_movil) > 20)) {
        responderErrorBaja(['telefono_movil' => '❌ Teléfono móvil inválido. Solo números y guiones. Máximo 20 caracteres.']);
    }
    if (!empty($telefono_fijo) && (!preg_match('/^[0-9\-]+$/', $telefono_fijo) || strlen($telefono_fijo) > 20)) {
        responderErrorBaja(['telefono_fijo' => '❌ Teléfono fijo inválido. Solo números y guiones. Máximo 20 caracteres.']);
    }
    if (!empty($dni) && (!preg_match('/^[0-9]+$/', $dni) || strlen($dni) > 20)) {
        responderErrorBaja(['dni' => '❌ DNI inválido. Solo números. Máximo 20 caracteres.']);
    }
    if (!empty($nacimiento) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $nacimiento)) {
        responderErrorBaja(['nacimiento' => '❌ Fecha de nacimiento inválida (YYYY-MM-DD).']);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha_baja)) {
        responderErrorBaja(['fecha_baja' => '❌ Fecha de baja inválida (YYYY-MM-DD).']);
    }

    foreach (['telefono_movil', 'telefono_fijo', 'comentario', 'nacimiento', 'dni'] as $campo) {
        if ($$campo === '') $$campo = null;
    }
    if ($domicilio_cobro === '') $domicilio_cobro = null;
    if ($motivo === '') $motivo = null;

    $ingreso = date('Y-m-d');
    $activo = 0;

    $sql = "
        INSERT INTO socios (
            nombre, id_cobrador, id_categoria, id_cat_monto, domicilio, numero,
            telefono_movil, telefono_fijo, comentario, nacimiento,
            id_estado, domicilio_cobro, dni, ingreso, activo, fecha_baja, motivo
        ) VALUES (
            :nombre, :id_cobrador, :id_categoria, :id_cat_monto, :domicilio, :numero,
            :telefono_movil, :telefono_fijo, :comentario, :nacimiento,
            :id_estado, :domicilio_cobro, :dni, :ingreso, :activo, :fecha_baja, :motivo
        )
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':nombre'          => $nombre,
        ':id_cobrador'     => $id_cobrador,
        ':id_categoria'    => $id_categoria,
        ':id_cat_monto'    => $id_cat_monto,
        ':domicilio'       => $domicilio,
        ':numero'          => $numero,
        ':telefono_movil'  => $telefono_movil,
        ':telefono_fijo'   => $telefono_fijo,
        ':comentario'      => $comentario,
        ':nacimiento'      => $nacimiento,
        ':id_estado'       => $id_estado,
        ':domicilio_cobro' => $domicilio_cobro,
        ':dni'             => $dni,
        ':ingreso'         => $ingreso,
        ':activo'          => $activo,
        ':fecha_baja'      => $fecha_baja,
        ':motivo'          => $motivo,
    ]);

    echo json_encode([
        'exito'   => true,
        'mensaje' => '✅ Socio cargado como dado de baja correctamente.',
        'id'      => $pdo->lastInsertId(),
        'activo'  => 0,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[AGREGAR_SOCIO_BAJA] ' . $e->getMessage());
    echo json_encode([
        'exito' => false,
        'mensaje' => '❌ Error inesperado: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
