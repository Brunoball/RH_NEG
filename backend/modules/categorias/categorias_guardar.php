<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $inputRaw = file_get_contents('php://input');
    $input = json_decode($inputRaw, true) ?? [];

    // acepta camelCase o snake_case
    $nombre        = strtoupper(trim($input['nombre'] ?? ''));
    $mMensualIn    = $input['montoMensual'] ?? $input['monto_mensual'] ?? $input['monto'] ?? null;
    $mAnualIn      = $input['montoAnual']   ?? $input['monto_anual']   ?? null;

    if ($nombre === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre es obligatorio.']);
        exit;
    }
    if (!is_numeric($mMensualIn) || $mMensualIn < 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Monto mensual inválido.']);
        exit;
    }
    if ($mAnualIn !== null && (!is_numeric($mAnualIn) || $mAnualIn < 0)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Monto anual inválido.']);
        exit;
    }

    $mMensual = (int)$mMensualIn;
    // si no te lo mandan, podés fijarlo a 0 o a 21000. Dejo 0 para que lo decidas desde la UI.
    $mAnual   = ($mAnualIn === null) ? 0 : (int)$mAnualIn;

    // opcional: evitar nombres duplicados
    $chk = $pdo->prepare("SELECT 1 FROM rh_neg.categoria_monto WHERE nombre_categoria = :n LIMIT 1");
    $chk->execute([':n' => $nombre]);
    if ($chk->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe una categoría con ese nombre.']);
        exit;
    }

    $sql = "INSERT INTO rh_neg.categoria_monto
                (nombre_categoria, monto_mensual, monto_anual, fecha_creacion)
            VALUES (:nombre, :mm, :ma, CURDATE())";
    $st = $pdo->prepare($sql);
    $st->execute([
        ':nombre' => $nombre,
        ':mm'     => $mMensual,
        ':ma'     => $mAnual,
    ]);

    echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'Error al guardar categoría', 'error' => $e->getMessage()]);
}
