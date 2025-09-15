<?php
// backend/modules/categorias/categorias_eliminar.php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Cargar DB si el router no lo hizo
if (!isset($pdo)) {
    $dbPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'db.php';
    if (!is_file($dbPath)) {
        http_response_code(500);
        echo json_encode(['ok'=>false,'mensaje'=>'No se encontró config/db.php','ruta'=>$dbPath], JSON_UNESCAPED_UNICODE);
        exit;
    }
    require_once $dbPath; // define $pdo
}

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Body esperado: { "idCategoria": <number> } (también acepta "id_cat_monto")
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $idIn  = $input['idCategoria'] ?? $input['id_cat_monto'] ?? null;
    if (!is_numeric($idIn)) {
        http_response_code(400);
        echo json_encode(['ok'=>false,'mensaje'=>'ID inválido.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $id = (int)$idIn;

    // ====== Helpers (sin hardcodear esquema) ======
    $schema = $pdo->query('SELECT DATABASE()')->fetchColumn();

    $hasCol = function(PDO $pdo, string $schema, string $table, string $column): bool {
        $q = $pdo->prepare("
            SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = :s AND TABLE_NAME = :t AND COLUMN_NAME = :c
             LIMIT 1
        ");
        $q->execute([':s'=>$schema, ':t'=>$table, ':c'=>$column]);
        return (bool)$q->fetchColumn();
    };
    $hasTable = function(PDO $pdo, string $schema, string $table): bool {
        $q = $pdo->prepare("
            SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = :s AND TABLE_NAME = :t
             LIMIT 1
        ");
        $q->execute([':s'=>$schema, ':t'=>$table]);
        return (bool)$q->fetchColumn();
    };

    if (!$hasTable($pdo, $schema, 'categoria_monto')) {
        http_response_code(404);
        echo json_encode(['ok'=>false,'mensaje'=>"La tabla 'categoria_monto' no existe en la base actual."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ====== Detectar columna de categoría en socios ======
    $colCategoriaSocios = null;
    if ($hasTable($pdo, $schema, 'socios')) {
        $cols = $pdo->query("SHOW COLUMNS FROM socios")->fetchAll(PDO::FETCH_COLUMN, 0);
        $candidatas = ['id_cat_monto','idCategoria','id_categoria','categoria_id','categoria','idCat','id_cat'];
        foreach ($candidatas as $c) {
            if (in_array($c, $cols, true)) { $colCategoriaSocios = $c; break; }
        }
    }

    // Si existe precios_historicos, lo usaremos para borrar hist. (opcional)
    $histExists = $hasTable($pdo, $schema, 'precios_historicos');
    $histFk     = null;
    if ($histExists) {
        if     ($hasCol($pdo,$schema,'precios_historicos','id_cat_monto')) $histFk='id_cat_monto';
        elseif ($hasCol($pdo,$schema,'precios_historicos','id_categoria')) $histFk='id_categoria';
    }

    // ====== Transacción ======
    $pdo->beginTransaction();

    // 0) Verificar que la categoría exista y bloquear
    $chk = $pdo->prepare("SELECT 1 FROM categoria_monto WHERE id_cat_monto = :id FOR UPDATE");
    $chk->execute([':id'=>$id]);
    if (!$chk->fetchColumn()) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['ok'=>false,'mensaje'=>'Categoría no encontrada.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 1) Contar y desasignar en socios (si hay columna detectada)
    $afectados = 0;
    $dejadoEn  = null;
    if ($colCategoriaSocios) {
        // ¿la columna admite NULL?
        $stmtCol = $pdo->prepare("SHOW COLUMNS FROM socios LIKE :col");
        $stmtCol->execute([':col'=>$colCategoriaSocios]);
        $info = $stmtCol->fetch(PDO::FETCH_ASSOC);
        $admiteNull = isset($info['Null']) && strtoupper($info['Null']) === 'YES';

        // contar
        $stCount = $pdo->prepare("SELECT COUNT(*) FROM socios WHERE `$colCategoriaSocios` = :id");
        $stCount->execute([':id'=>$id]);
        $afectados = (int)$stCount->fetchColumn();

        if ($afectados > 0) {
            if ($admiteNull) {
                $st = $pdo->prepare("UPDATE socios SET `$colCategoriaSocios` = NULL WHERE `$colCategoriaSocios` = :id");
                $dejadoEn = 'NULL';
            } else {
                $st = $pdo->prepare("UPDATE socios SET `$colCategoriaSocios` = 0 WHERE `$colCategoriaSocios` = :id");
                $dejadoEn = '0';
            }
            $st->execute([':id'=>$id]);
        }
    }

    // 2) Borrar historial asociado (si existe tabla y FK)
    if ($histExists && $histFk) {
        $delHist = $pdo->prepare("DELETE FROM precios_historicos WHERE `$histFk` = :id");
        $delHist->execute([':id'=>$id]);
    }

    // 3) Eliminar categoría (solo nombre de tabla, sin prefijo de DB)
    $del = $pdo->prepare("DELETE FROM categoria_monto WHERE id_cat_monto = :id");
    $del->execute([':id'=>$id]);

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'mensaje' => 'Categoría eliminada.',
        'socios_afectados' => $afectados,
        'columna_usada_en_socios' => $colCategoriaSocios,
        'dejado_en' => $dejadoEn
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'ok'=>false,
        'mensaje'=>'Error al eliminar la categoría.',
        // Descomentar para diagnóstico puntual:
        // 'error'=>$e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
