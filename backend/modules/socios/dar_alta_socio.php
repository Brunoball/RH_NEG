<?php
/**
 * RH_NEGATIVO/api/modules/socios/dar_alta_socio.php
 * Reactiva un socio y actualiza la fecha de ingreso con la elegida en el modal.
 * Acepta:
 *   - POST x-www-form-urlencoded: id_socio, fecha_ingreso
 *   - JSON: { "id_socio": <int>, "fecha_ingreso": "YYYY-MM-DD" | "DD/MM/YYYY" }
 */

declare(strict_types=1);

// No mostrar warnings/notices porque rompen el JSON
ini_set('display_errors', '0');
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    // --- Preferimos $_POST (x-www-form-urlencoded). Si viene vacío, intentamos JSON ---
    $id = 0;
    $fechaIngresada = '';

    if (!empty($_POST)) {
        $id = isset($_POST['id_socio']) ? (int)$_POST['id_socio'] : 0;
        $fechaIngresada = isset($_POST['fecha_ingreso']) ? trim((string)$_POST['fecha_ingreso']) : '';
    } else {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $id = isset($data['id_socio']) ? (int)$data['id_socio'] : 0;
            $fechaIngresada = isset($data['fecha_ingreso']) ? trim((string)$data['fecha_ingreso']) : '';
        }
    }

    if ($id <= 0) {
        http_response_code(422);
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado o inválido']);
        exit;
    }

    // Normalizar fecha a Y-m-d (acepta "YYYY-MM-DD" o "DD/MM/YYYY")
    $fechaValida = normalizarFecha($fechaIngresada); // null si no es válida

    // IMPORTANTE: usar la base activa del PDO (no calificar con otro esquema).
    $tabla = '`socios`';

    if ($fechaValida !== null) {
        $sql = "UPDATE {$tabla}
                   SET activo = 1,
                       motivo = NULL,
                       ingreso = :fecha
                 WHERE id_socio = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':fecha' => $fechaValida,
            ':id'    => $id,
        ]);
        $usada = $fechaValida;
    } else {
        // Sin fecha válida: usar fecha del sistema
        $sql = "UPDATE {$tabla}
                   SET activo = 1,
                       motivo = NULL,
                       ingreso = CURDATE()
                 WHERE id_socio = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $usada = 'CURDATE()';
    }

    // Verificar existencia del socio (si no afectó filas, pudo no existir o ya estar igual)
    if ($stmt->rowCount() === 0) {
        // Chequear si existe
        $chk = $pdo->prepare("SELECT id_socio FROM {$tabla} WHERE id_socio = :id LIMIT 1");
        $chk->execute([':id' => $id]);
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'El socio no existe']);
            exit;
        }
    }

    echo json_encode([
        'exito'       => true,
        'mensaje'     => 'Socio dado de alta correctamente',
        'fecha_usada' => $usada
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
    exit;
}

/**
 * Convierte una fecha en string a 'Y-m-d' si es válida.
 * Acepta 'Y-m-d' o 'd/m/Y'. Si no es válida, devuelve null.
 */
function normalizarFecha(string $s): ?string {
    $s = trim($s);
    if ($s === '') return null;

    // Formato 1: YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        $dt  = DateTime::createFromFormat('Y-m-d', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    // Formato 2: DD/MM/YYYY
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $s)) {
        $dt  = DateTime::createFromFormat('d/m/Y', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    return null;
}
