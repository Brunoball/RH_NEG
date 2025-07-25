<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function aMayus($texto) {
    return isset($texto) && trim($texto) !== '' ? mb_strtoupper(trim($texto), 'UTF-8') : null;
}

function responderError($errores) {
    echo json_encode(['exito' => false, 'errores' => $errores]);
    exit;
}

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || !is_array($data)) {
        responderError(['general' => '❌ Datos no válidos o vacíos.']);
    }

    // ✅ Obligatorio
    $nombre = aMayus($data['nombre'] ?? '');

    if (!$nombre || trim($nombre) === '') {
        responderError(['nombre' => '⚠️ El nombre completo es obligatorio.']);
    }

    if (!preg_match("/^[a-zA-ZñÑ\s.]+$/u", $nombre) || mb_strlen($nombre, 'UTF-8') > 100) {
        responderError(['nombre' => '❌ Solo letras, espacios y puntos. Máximo 100 caracteres.']);
    }

    // ✅ Opcionales
    $id_cobrador = is_numeric($data['id_cobrador'] ?? null) ? (int)$data['id_cobrador'] : null;
    $id_categoria = is_numeric($data['id_categoria'] ?? null) ? (int)$data['id_categoria'] : null;
    $domicilio = aMayus($data['domicilio'] ?? '');
    $numero = trim($data['numero'] ?? '');
    $telefono_movil = trim($data['telefono_movil'] ?? '');
    $telefono_fijo = trim($data['telefono_fijo'] ?? '');
    $comentario = aMayus($data['comentario'] ?? '');
    $nacimiento = !empty($data['nacimiento']) ? $data['nacimiento'] : null;
    $id_estado = is_numeric($data['id_estado'] ?? null) ? (int)$data['id_estado'] : null;
    $domicilio_cobro = aMayus($data['domicilio_cobro'] ?? '');
    $dni = trim($data['dni'] ?? '');
    $ingreso = date("Y-m-d");
    $deuda_2024 = null;
    $id_periodo = null; // Cambiado aquí

    // ✅ Validar si tienen valor
    if (!empty($domicilio) && (!preg_match("/^[a-zA-Z0-9ñÑ\s.]+$/u", $domicilio) || mb_strlen($domicilio, 'UTF-8') > 100)) {
        responderError(['domicilio' => '❌ Domicilio inválido. Letras, números, espacios y puntos. Máximo 100 caracteres.']);
    }

    if (!empty($domicilio_cobro) && (!preg_match("/^[a-zA-Z0-9ñÑ\s.]+$/u", $domicilio_cobro) || mb_strlen($domicilio_cobro, 'UTF-8') > 150)) {
        responderError(['domicilio_cobro' => '❌ Domicilio de cobro inválido. Máximo 150 caracteres.']);
    }

    if (!empty($comentario) && (!preg_match("/^[a-zA-Z0-9ñÑ\s.,-]+$/u", $comentario) || mb_strlen($comentario, 'UTF-8') > 1000)) {
        responderError(['comentario' => '❌ Comentario inválido. Letras, números, comas y puntos. Máximo 1000 caracteres.']);
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

    // Convertir vacíos a null
    foreach (['domicilio','numero','telefono_movil','telefono_fijo','comentario','nacimiento','domicilio_cobro','dni'] as $campo) {
        if ($$campo === '') $$campo = null;
    }

    // ✅ Insertar
    $stmt = $pdo->prepare("
        INSERT INTO socios (
            nombre, id_cobrador, id_categoria, domicilio, numero,
            telefono_movil, telefono_fijo, comentario, nacimiento,
            id_estado, domicilio_cobro, dni, ingreso, deuda_2024, id_periodo, activo
        ) VALUES (
            :nombre, :id_cobrador, :id_categoria, :domicilio, :numero,
            :telefono_movil, :telefono_fijo, :comentario, :nacimiento,
            :id_estado, :domicilio_cobro, :dni, :ingreso, :deuda_2024, :id_periodo, 1
        )
    ");

    $stmt->execute([
        ':nombre' => $nombre,
        ':id_cobrador' => $id_cobrador,
        ':id_categoria' => $id_categoria,
        ':domicilio' => $domicilio,
        ':numero' => $numero,
        ':telefono_movil' => $telefono_movil,
        ':telefono_fijo' => $telefono_fijo,
        ':comentario' => $comentario,
        ':nacimiento' => $nacimiento,
        ':id_estado' => $id_estado,
        ':domicilio_cobro' => $domicilio_cobro,
        ':dni' => $dni,
        ':ingreso' => $ingreso,
        ':deuda_2024' => $deuda_2024,
        ':id_periodo' => $id_periodo
    ]);

    echo json_encode(['exito' => true, 'mensaje' => '✅ Socio registrado correctamente.']);
} catch (Exception $e) {
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error inesperado: ' . $e->getMessage()]);
}
