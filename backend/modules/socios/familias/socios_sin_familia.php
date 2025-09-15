<?php
// backend/modules/socios/familias/socios_sin_familia.php
require_once __DIR__ . '/_common.php';

$pdo = fam_pdo();

$q = fam_str($_GET['q'] ?? '');

$sql = "SELECT s.id_socio, s.nombre, s.dni, s.domicilio, s.numero, s.activo
        FROM socios s
        WHERE s.id_familia IS NULL
          AND s.activo = 1";

$params = [];
if ($q !== '') {
    $sql .= " AND (s.nombre LIKE :q OR s.dni LIKE :q)";
    $params[':q'] = "%$q%";
}

$sql .= " ORDER BY s.nombre ASC"; // SIN LIMIT

$st = $pdo->prepare($sql);
$st->execute($params);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

fam_json(['exito' => true, 'socios' => $rows]);
