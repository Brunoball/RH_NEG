<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php'; // debe exponer fam_json() y fam_pdo()

// Siempre responder JSON
header('Content-Type: application/json; charset=UTF-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fam_json(['exito' => false, 'mensaje' => 'Método no permitido'], 405);
    }

    $raw = file_get_contents('php://input') ?: '';
    $input = json_decode($raw, true);

    if (!is_array($input)) {
        fam_json(['exito' => false, 'mensaje' => 'JSON inválido'], 400);
    }

    // Normalizo por las dudas para que estén siempre presentes
    $id_familia = $input['id_familia'] ?? null;

    // Reinyecto el body para los handlers (si querés conservar ese patrón)
    $GLOBALS['__FAM_POST_BODY__'] = $raw;

    if ($id_familia !== '' && $id_familia !== null) {
        require __DIR__ . '/editar_familia.php';
    } else {
        require __DIR__ . '/agregar_familia.php';
    }
} catch (Throwable $e) {
    fam_json(
        ['exito' => false, 'mensaje' => 'Error inesperado en familia_guardar', 'error' => $e->getMessage()],
        500
    );
}
