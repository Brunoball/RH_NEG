<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    // Aseguramos excepciones por si db.php no las deja configuradas
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $id         = $input['idCategoria'] ?? $input['id_cat_monto'] ?? null;
    $nombre     = strtoupper(trim($input['nombre'] ?? ''));
    $mMensualIn = $input['montoMensual'] ?? $input['monto_mensual'] ?? $input['monto'] ?? null;
    $mAnualIn   = $input['montoAnual']   ?? $input['monto_anual']   ?? null;

    // -------- Validaciones básicas
    if (!is_numeric($id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'ID inválido.']);
        exit;
    }
    if ($nombre === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre es obligatorio.']);
        exit;
    }
    if (!is_numeric($mMensualIn) || $mMensualIn < 0 || !is_numeric($mAnualIn) || $mAnualIn < 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Montos inválidos.']);
        exit;
    }

    $mMensual = (int)$mMensualIn;
    $mAnual   = (int)$mAnualIn;

    // -------- Evitar duplicado de nombre
    $chk = $pdo->prepare(
        "SELECT 1
           FROM rh_neg.categoria_monto
          WHERE nombre_categoria = :n AND id_cat_monto <> :id
          LIMIT 1"
    );
    $chk->execute([':n' => $nombre, ':id' => $id]);
    if ($chk->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe otra categoría con ese nombre.']);
        exit;
    }

    // Helper para detectar columnas
    $hasColumn = function(PDO $pdo, string $schema, string $table, string $column): bool {
        $q = $pdo->prepare("
            SELECT 1
              FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = :s AND TABLE_NAME = :t AND COLUMN_NAME = :c
             LIMIT 1
        ");
        $q->execute([':s' => $schema, ':t' => $table, ':c' => $column]);
        return (bool)$q->fetchColumn();
    };

    $pdo->beginTransaction();

    // -------- Leemos valores actuales y bloqueamos fila
    $sel = $pdo->prepare(
        "SELECT nombre_categoria, monto_mensual, monto_anual
           FROM rh_neg.categoria_monto
          WHERE id_cat_monto = :id
          FOR UPDATE"
    );
    $sel->execute([':id' => $id]);
    $actual = $sel->fetch(PDO::FETCH_ASSOC);
    if (!$actual) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Categoría no encontrada.']);
        exit;
    }

    $oldMensual = (int)$actual['monto_mensual'];
    $oldAnual   = (int)$actual['monto_anual'];

    // -------- Preparar INSERT a precios_historicos (con o sin 'tipo')
    $schema    = $pdo->query('SELECT DATABASE()')->fetchColumn();
    $tablaHist = 'precios_historicos';
    $hasTipo   = $hasColumn($pdo, $schema, $tablaHist, 'tipo');

    if ($hasTipo) {
        // OJO: tu ENUM es 'mensual' / 'anual'
        $sqlHist = "INSERT INTO rh_neg.$tablaHist
            (id_cat_monto, tipo, precio_viejo, precio_nuevo, fecha_cambio)
            VALUES (:id, :tipo, :viejo, :nuevo, CURDATE())";
    } else {
        $sqlHist = "INSERT INTO rh_neg.$tablaHist
            (id_cat_monto, precio_viejo, precio_nuevo, fecha_cambio)
            VALUES (:id, :viejo, :nuevo, CURDATE())";
    }
    $histInsert = $pdo->prepare($sqlHist);
    $histCount  = 0;

    // -------- Registrar historial SOLO si cambian los valores
    if ($mMensual !== $oldMensual) {
        $params = [
            ':id'    => $id,
            ':viejo' => $oldMensual,
            ':nuevo' => $mMensual
        ];
        if ($hasTipo) $params[':tipo'] = 'mensual'; // <-- valor ENUM correcto
        $histInsert->execute($params);
        $histCount++;
    }

    if ($mAnual !== $oldAnual) {
        $params = [
            ':id'    => $id,
            ':viejo' => $oldAnual,
            ':nuevo' => $mAnual
        ];
        if ($hasTipo) $params[':tipo'] = 'anual'; // <-- valor ENUM correcto
        $histInsert->execute($params);
        $histCount++;
    }

    // -------- Actualizar categoría
    $upd = $pdo->prepare(
        "UPDATE rh_neg.categoria_monto
            SET nombre_categoria = :n,
                monto_mensual    = :mm,
                monto_anual      = :ma
          WHERE id_cat_monto     = :id"
    );
    $upd->execute([
        ':n'  => $nombre,
        ':mm' => $mMensual,
        ':ma' => $mAnual,
        ':id' => $id,
    ]);

    $pdo->commit();
    echo json_encode(['ok' => true, 'historial_insertado' => $histCount], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'ok'      => false,
        'mensaje' => 'Error al actualizar categoría',
        'error'   => $e->getMessage()
    ]);
}
