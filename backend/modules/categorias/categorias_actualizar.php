<?php
// backend/modules/categorias/categorias_actualizar.php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    // Cargar conexión
    if (!isset($pdo)) {
        $dbPath = dirname(__DIR__, 2) . '/config/db.php';
        if (!is_file($dbPath)) {
            http_response_code(500);
            echo json_encode(['ok'=>false,'mensaje'=>'No se encontró config/db.php','path'=>$dbPath], JSON_UNESCAPED_UNICODE);
            exit;
        }
        require_once $dbPath; // define $pdo
    }

    // Asegurar modo excepción y fetch por defecto
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $idIn       = $input['idCategoria']   ?? $input['id_cat_monto'] ?? null;
    $nombreIn   = $input['nombre']        ?? $input['nombre_categoria'] ?? '';
    $mensualIn  = $input['montoMensual']  ?? $input['monto_mensual'] ?? $input['monto'] ?? null;
    $anualIn    = $input['montoAnual']    ?? $input['monto_anual']   ?? null;

    // Validaciones
    if (!is_numeric($idIn)) {
        http_response_code(400);
        echo json_encode(['ok'=>false,'mensaje'=>'ID inválido.']);
        exit;
    }
    $id      = (int)$idIn;
    $nombre  = strtoupper(trim((string)$nombreIn));
    $mMensual= is_numeric($mensualIn) ? (int)$mensualIn : null;
    $mAnual  = is_numeric($anualIn)   ? (int)$anualIn   : null;

    if ($nombre === '') {
        http_response_code(400);
        echo json_encode(['ok'=>false,'mensaje'=>'El nombre es obligatorio.']);
        exit;
    }
    if ($mMensual === null || $mMensual < 0 || $mAnual === null || $mAnual < 0) {
        http_response_code(400);
        echo json_encode(['ok'=>false,'mensaje'=>'Montos inválidos.']);
        exit;
    }

    // === Evitar duplicado de nombre (en misma tabla)
    $chk = $pdo->prepare("
        SELECT 1
          FROM categoria_monto
         WHERE nombre_categoria = :n AND id_cat_monto <> :id
         LIMIT 1
    ");
    $chk->execute([':n'=>$nombre, ':id'=>$id]);
    if ($chk->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['ok'=>false,'mensaje'=>'Ya existe otra categoría con ese nombre.']);
        exit;
    }

    $pdo->beginTransaction();

    // === Leer actual y bloquear fila
    $sel = $pdo->prepare("
        SELECT nombre_categoria, monto_mensual, monto_anual
          FROM categoria_monto
         WHERE id_cat_monto = :id
         FOR UPDATE
    ");
    $sel->execute([':id'=>$id]);
    $cur = $sel->fetch();
    if (!$cur) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['ok'=>false,'mensaje'=>'Categoría no encontrada.']);
        exit;
    }

    $oldMensual = (int)$cur['monto_mensual'];
    $oldAnual   = (int)$cur['monto_anual'];

    // === Preparar historial (si existe la tabla/columnas)
    $schema = $pdo->query('SELECT DATABASE()')->fetchColumn();

    $hasColumn = function(PDO $pdo, string $schema, string $table, string $column): bool {
        $q = $pdo->prepare("
            SELECT 1
              FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = :s AND TABLE_NAME = :t AND COLUMN_NAME = :c
             LIMIT 1
        ");
        $q->execute([':s'=>$schema, ':t'=>$table, ':c'=>$column]);
        return (bool)$q->fetchColumn();
    };

    $histInsertCount = 0;
    // Verifico que exista la tabla precios_historicos y sus columnas mínimas
    $hasHistTable = $pdo->prepare("
        SELECT 1
          FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = :s AND TABLE_NAME = 'precios_historicos'
         LIMIT 1
    ");
    $hasHistTable->execute([':s'=>$schema]);
    if ($hasHistTable->fetchColumn()) {
        $hasTipo  = $hasColumn($pdo, $schema, 'precios_historicos', 'tipo');
        $hasFk    = $hasColumn($pdo, $schema, 'precios_historicos', 'id_cat_monto');
        $hasViejo = $hasColumn($pdo, $schema, 'precios_historicos', 'precio_viejo');
        $hasNuevo = $hasColumn($pdo, $schema, 'precios_historicos', 'precio_nuevo');
        $hasFecha = $hasColumn($pdo, $schema, 'precios_historicos', 'fecha_cambio');

        if ($hasFk && $hasViejo && $hasNuevo) {
            if ($hasTipo && $hasFecha) {
                $sqlHist = "INSERT INTO precios_historicos
                    (id_cat_monto, tipo, precio_viejo, precio_nuevo, fecha_cambio)
                    VALUES (:id, :tipo, :viejo, :nuevo, NOW())";
            } elseif ($hasTipo) {
                $sqlHist = "INSERT INTO precios_historicos
                    (id_cat_monto, tipo, precio_viejo, precio_nuevo)
                    VALUES (:id, :tipo, :viejo, :nuevo)";
            } elseif ($hasFecha) {
                $sqlHist = "INSERT INTO precios_historicos
                    (id_cat_monto, precio_viejo, precio_nuevo, fecha_cambio)
                    VALUES (:id, :viejo, :nuevo, NOW())";
            } else {
                $sqlHist = "INSERT INTO precios_historicos
                    (id_cat_monto, precio_viejo, precio_nuevo)
                    VALUES (:id, :viejo, :nuevo)";
            }
            $insHist = $pdo->prepare($sqlHist);

            // Registrar solo cambios
            if ($mMensual !== $oldMensual) {
                $params = [':id'=>$id, ':viejo'=>$oldMensual, ':nuevo'=>$mMensual];
                if ($hasTipo) $params[':tipo'] = 'mensual';
                $insHist->execute($params);
                $histInsertCount++;
            }
            if ($mAnual !== $oldAnual) {
                $params = [':id'=>$id, ':viejo'=>$oldAnual, ':nuevo'=>$mAnual];
                if ($hasTipo) $params[':tipo'] = 'anual';
                $insHist->execute($params);
                $histInsertCount++;
            }
        }
    }

    // === Actualizar categoría (sin prefijo de DB)
    $upd = $pdo->prepare("
        UPDATE categoria_monto
           SET nombre_categoria = :n,
               monto_mensual    = :mm,
               monto_anual      = :ma
         WHERE id_cat_monto     = :id
    ");
    $upd->execute([
        ':n'=>$nombre,
        ':mm'=>$mMensual,
        ':ma'=>$mAnual,
        ':id'=>$id
    ]);

    $pdo->commit();
    echo json_encode(['ok'=>true, 'historial_insertado'=>$histInsertCount], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'ok'=>false,
        'mensaje'=>'Error al actualizar categoría',
        // Descomentar para debug puntual:
        // 'error'=>$e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
