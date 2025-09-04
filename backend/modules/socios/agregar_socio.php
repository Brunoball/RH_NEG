<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

// Producción: no mostrar errores en pantalla (pero sí loguearlos)
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

/** Helpers */
function aMayus($texto) {
    return isset($texto) && trim($texto) !== '' ? mb_strtoupper(trim($texto), 'UTF-8') : null;
}
function responderError($errores) {
    echo json_encode(['exito' => false, 'errores' => $errores], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || !is_array($data)) {
        responderError(['general' => '❌ Datos no válidos o vacíos.']);
    }

    // ===== Campos separados: APELLIDO y NOMBRES =====
    $apellido = aMayus($data['apellido'] ?? '');
    $nombres  = aMayus($data['nombres']  ?? '');

    // Validaciones obligatorias
    if (!$apellido || trim($apellido) === '') {
        responderError(['apellido' => '⚠️ El apellido es obligatorio.']);
    }
    if (!$nombres || trim($nombres) === '') {
        responderError(['nombres' => '⚠️ El nombre es obligatorio.']);
    }

    // Solo letras Unicode y espacios, máx 100 c/u
    if (!preg_match("/^[\p{L}\s]+$/u", $apellido) || mb_strlen($apellido, 'UTF-8') > 100) {
        responderError(['apellido' => '❌ Solo letras y espacios. Máximo 100 caracteres.']);
    }
    if (!preg_match("/^[\p{L}\s]+$/u", $nombres) || mb_strlen($nombres, 'UTF-8') > 100) {
        responderError(['nombres' => '❌ Solo letras y espacios. Máximo 100 caracteres.']);
    }

    // Nombre completo a persistir en la columna `nombre`
    $nombre = trim($apellido . ' ' . $nombres);

    // ===== Resto de campos (opcionales) =====
    $id_cobrador     = is_numeric($data['id_cobrador'] ?? null) ? (int)$data['id_cobrador'] : null;
    $id_categoria    = is_numeric($data['id_categoria'] ?? null) ? (int)$data['id_categoria'] : null;
    $domicilio       = aMayus($data['domicilio'] ?? '');
    $numero          = trim($data['numero'] ?? '');
    $telefono_movil  = trim($data['telefono_movil'] ?? '');
    $telefono_fijo   = trim($data['telefono_fijo'] ?? '');
    $comentario      = aMayus($data['comentario'] ?? '');
    $nacimiento      = !empty($data['nacimiento']) ? $data['nacimiento'] : null; // YYYY-MM-DD
    $id_estado       = is_numeric($data['id_estado'] ?? null) ? (int)$data['id_estado'] : null;
    $domicilio_cobro = $data['domicilio_cobro'] ?? '';
    $dni             = trim($data['dni'] ?? '');
    $ingreso         = date("Y-m-d");
    $activo          = 1;

    // Validaciones de formato si traen valor
    if (!empty($domicilio) && (!preg_match("/^[\p{L}\p{N}\s.,-]+$/u", $domicilio) || mb_strlen($domicilio, 'UTF-8') > 100)) {
        responderError(['domicilio' => '❌ Domicilio inválido. Letras/números, espacios y . , -. Máximo 100 caracteres.']);
    }
    if (!empty($domicilio_cobro) && mb_strlen($domicilio_cobro, 'UTF-8') > 150) {
        responderError(['domicilio_cobro' => '❌ Máximo 150 caracteres.']);
    }
    if (!empty($comentario) && (!preg_match("/^[\p{L}\p{N}\s.,-]+$/u", $comentario) || mb_strlen($comentario, 'UTF-8') > 1000)) {
        responderError(['comentario' => '❌ Comentario inválido. Letras/números, espacios y . , -. Máximo 1000 caracteres.']);
    }
    if (!empty($numero) && (!preg_match("/^[0-9]+$/", $numero) || strlen($numero) > 20)) {
        responderError(['numero' => '❌ Solo números. Máximo 20 caracteres.']);
    }
    if (!empty($telefono_movil) && (!preg_match("/^[0-9\-]+$/", $telefono_movil) || strlen($telefono_movil) > 20)) {
        responderError(['telefono_movil' => '❌ Teléfono móvil inválido. Solo números y guiones. Máximo 20 caracteres.']);
    }
    if (!empty($telefono_fijo) && (!preg_match("/^[0-9\-]+$/", $telefono_fijo) || strlen($telefono_fijo) > 20)) {
        responderError(['telefono_fijo' => '❌ Teléfono fijo inválido. Solo números y guiones. Máximo 20 caracteres.']);
    }
    if (!empty($dni) && (!preg_match("/^[0-9]+$/", $dni) || strlen($dni) > 20)) {
        responderError(['dni' => '❌ DNI inválido. Solo números. Máximo 20 caracteres.']);
    }

    // Normalización de vacíos a NULL
    foreach (['domicilio','numero','telefono_movil','telefono_fijo','comentario','nacimiento','dni'] as $campo) {
        if ($$campo === '') $$campo = null;
    }
    if ($domicilio_cobro === '') $domicilio_cobro = null;

    // Insert
    $sql = "
        INSERT INTO socios (
            nombre, id_cobrador, id_categoria, domicilio, numero,
            telefono_movil, telefono_fijo, comentario, nacimiento,
            id_estado, domicilio_cobro, dni, ingreso, activo
        ) VALUES (
            :nombre, :id_cobrador, :id_categoria, :domicilio, :numero,
            :telefono_movil, :telefono_fijo, :comentario, :nacimiento,
            :id_estado, :domicilio_cobro, :dni, :ingreso, :activo
        )
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':nombre'          => $nombre,
        ':id_cobrador'     => $id_cobrador,
        ':id_categoria'    => $id_categoria,
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
        ':activo'          => $activo
    ]);

    echo json_encode([
        'exito'   => true,
        'mensaje' => '✅ Socio registrado correctamente.',
        'id'      => $pdo->lastInsertId()
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error inesperado: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
