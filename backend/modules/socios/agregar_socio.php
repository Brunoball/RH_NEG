<?php
// CORS
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

// Función para pasar a MAYÚSCULAS con soporte UTF-8 y Ñ
function aMayus($texto) {
    return isset($texto) && trim($texto) !== '' ? mb_strtoupper(trim($texto), 'UTF-8') : null;
}

function responderError($errores) {
    echo json_encode(['exito' => false, 'errores' => $errores]);
    exit;
}

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data) {
        responderError(['general' => '⚠️ No se recibieron datos válidos.']);
    }

    // Sanitizar
    $nombre = aMayus($data['nombre'] ?? '');
    $id_cobrador = is_numeric($data['id_cobrador']) ? (int)$data['id_cobrador'] : null;
    $id_categoria = is_numeric($data['id_categoria']) ? (int)$data['id_categoria'] : null;
    $domicilio = aMayus($data['domicilio'] ?? '');
    $numero = trim($data['numero'] ?? '');
    $telefono_movil = trim($data['telefono_movil'] ?? '');
    $telefono_fijo = trim($data['telefono_fijo'] ?? '');
    $comentario = aMayus($data['comentario'] ?? '');
    $nacimiento = $data['nacimiento'] ?: null;
    $id_estado = is_numeric($data['id_estado']) ? (int)$data['id_estado'] : null;
    $domicilio_cobro = aMayus($data['domicilio_cobro'] ?? '');
    $dni = trim($data['dni'] ?? '');
    $ingreso = date('Y-m-d');

    $errores = [];

    // Validar campos
    if (!$nombre) {
        $errores['nombre'] = '⚠️ El campo "nombre" es obligatorio.';
    } elseif (!preg_match("/^[a-zA-ZñÑ\s.]+$/u", $nombre) || mb_strlen($nombre, 'UTF-8') > 40) {
        $errores['nombre'] = '❌ Solo puede contener letras, espacios y puntos. Máximo 40 caracteres.';
    }

    if ($domicilio && (!preg_match("/^[a-zA-Z0-9ñÑ\s.]+$/u", $domicilio) || mb_strlen($domicilio, 'UTF-8') > 40)) {
        $errores['domicilio'] = '❌ Solo puede contener letras, números, espacios y puntos. Máximo 40 caracteres.';
    }

    if ($domicilio_cobro && (!preg_match("/^[a-zA-Z0-9ñÑ\s.]+$/u", $domicilio_cobro) || mb_strlen($domicilio_cobro, 'UTF-8') > 40)) {
        $errores['domicilio_cobro'] = '❌ Solo puede contener letras, números, espacios y puntos. Máximo 40 caracteres.';
    }

    if ($comentario && (!preg_match("/^[a-zA-Z0-9ñÑ\s.]+$/u", $comentario) || mb_strlen($comentario, 'UTF-8') > 60)) {
        $errores['comentario'] = '❌ Solo puede contener letras, números, espacios y puntos. Máximo 60 caracteres.';
    }

    if ($numero !== '' && (!preg_match("/^[0-9]+$/", $numero) || strlen($numero) > 20)) {
        $errores['numero'] = '❌ Solo puede contener números (sin letras). Máximo 20 dígitos.';
    }

    if ($telefono_movil !== '' && (!preg_match("/^[0-9\-]+$/", $telefono_movil) || strlen($telefono_movil) > 20)) {
        $errores['telefono_movil'] = '❌ Solo puede contener números y guiones, hasta 20 caracteres.';
    }

    if ($telefono_fijo !== '' && (!preg_match("/^[0-9\-]+$/", $telefono_fijo) || strlen($telefono_fijo) > 20)) {
        $errores['telefono_fijo'] = '❌ Solo puede contener números y guiones, hasta 20 caracteres.';
    }

    if ($dni !== '' && (!preg_match("/^[0-9.]+$/", $dni) || strlen($dni) > 20)) {
        $errores['dni'] = '❌ Solo puede contener números y puntos, hasta 20 caracteres.';
    }

    // Si hay errores, no continuar
    if (!empty($errores)) {
        responderError($errores);
    }

    // Convertir campos vacíos a null
    $numero = $numero === '' ? null : $numero;
    $telefono_movil = $telefono_movil === '' ? null : $telefono_movil;
    $telefono_fijo = $telefono_fijo === '' ? null : $telefono_fijo;
    $dni = $dni === '' ? null : $dni;

    // Insertar
    $stmt = $pdo->prepare("
        INSERT INTO socios (
            nombre, id_cobrador, id_categoria, domicilio, numero,
            telefono_movil, telefono_fijo, comentario, nacimiento,
            id_estado, domicilio_cobro, dni, ingreso
        ) VALUES (
            :nombre, :id_cobrador, :id_categoria, :domicilio, :numero,
            :telefono_movil, :telefono_fijo, :comentario, :nacimiento,
            :id_estado, :domicilio_cobro, :dni, :ingreso
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
        ':ingreso' => $ingreso
    ]);

    echo json_encode(['exito' => true, 'mensaje' => '✅ Socio registrado correctamente.']);
} catch (Exception $e) {
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error inesperado: ' . $e->getMessage()]);
}
