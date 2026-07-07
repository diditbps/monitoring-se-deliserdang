<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$type = isset($_GET['type']) ? $_GET['type'] : 'data';
$date = isset($_GET['date']) ? preg_replace('/[^0-9-]/', '', $_GET['date']) : '';

if ($type === 'dates') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $files = glob(__DIR__ . '/data_*.json');
        $dates = [];
        foreach ($files as $f) {
            if (preg_match('/data_(\d{4}-\d{2}-\d{2})\.json$/', basename($f), $matches)) {
                $dates[] = $matches[1];
            }
        }
        rsort($dates); // Sort descending
        header('Content-Type: application/json');
        echo json_encode($dates);
        exit;
    }
}

if ($type === 'history') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $files = glob(__DIR__ . '/data_*.json');
        rsort($files);
        $files = array_slice($files, 0, 30);
        $history = [];
        $ignoredFile = __DIR__ . '/ignored.json';
        $ignoredEmails = [];
        if (file_exists($ignoredFile)) {
            $ignoredEmails = json_decode(file_get_contents($ignoredFile), true) ?: [];
        }
        $kecamatanFilter = isset($_GET['kecamatan']) ? $_GET['kecamatan'] : '';
        $desaFilter = isset($_GET['desa']) ? $_GET['desa'] : '';
        $mitraTypeFilter = isset($_GET['mitraType']) ? $_GET['mitraType'] : '';
        
        $affirmasiEmails = [];
        if ($mitraTypeFilter !== '') {
            $affirmasiFile = __DIR__ . '/affirmasi.json';
            if (file_exists($affirmasiFile)) {
                $affData = json_decode(file_get_contents($affirmasiFile), true);
                if (is_array($affData)) {
                    foreach ($affData as $a) {
                        if (isset($a['email'])) $affirmasiEmails[] = strtolower($a['email']);
                    }
                }
            }
        }
        
        foreach ($files as $f) {
            if (preg_match('/data_(\d{4}-\d{2}-\d{2})\.json$/', basename($f), $matches)) {
                $date = $matches[1];
                $data = json_decode(file_get_contents($f), true);
                if (is_array($data)) {
                    $totalSampelRaw = 0;
                    $totalDoneRaw = 0;
                    foreach ($data as $e) {
                        if (isset($e['email']) && in_array($e['email'], $ignoredEmails)) {
                            continue;
                        }
                        if ($kecamatanFilter !== '') {
                            $fetchLabel = isset($e['fetchLabel']) ? $e['fetchLabel'] : '';
                            if ($fetchLabel !== $kecamatanFilter) {
                                continue;
                            }
                        }
                        if ($desaFilter !== '') {
                            $hasDesa = false;
                            if (isset($e['regionSummary']) && is_array($e['regionSummary'])) {
                                foreach ($e['regionSummary'] as $r) {
                                    if (isset($r['regionCode']) && strlen($r['regionCode']) >= 10) {
                                        if (substr($r['regionCode'], 7, 3) === $desaFilter) {
                                            $hasDesa = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (!$hasDesa) continue;
                        }
                        if ($mitraTypeFilter !== '') {
                            $eEmail = isset($e['email']) ? strtolower($e['email']) : '';
                            $isAff = in_array($eEmail, $affirmasiEmails);
                            if ($mitraTypeFilter === 'Affirmasi' && !$isAff) continue;
                            if ($mitraTypeFilter === 'Umum' && $isAff) continue;
                        }
                        
                        if (isset($e['total'])) {
                            $totalSampelRaw += $e['total'];
                        }
                        if (isset($e['regionSummary']) && is_array($e['regionSummary'])) {
                            foreach ($e['regionSummary'] as $r) {
                                if (isset($r['statusBreakdown']) && is_array($r['statusBreakdown'])) {
                                    foreach ($r['statusBreakdown'] as $s) {
                                        $st = strtolower($s['status']);
                                        if (strpos($st, 'submitted') !== false || strpos($st, 'approved') !== false || strpos($st, 'rejected') !== false) {
                                            $totalDoneRaw += $s['count'];
                                        }
                                    }
                                }
                            }
                        }
                    }
                    $totalSampel = round($totalSampelRaw / 2);
                    $totalDone = round($totalDoneRaw / 2);
                    $overallPct = $totalSampel > 0 ? round(($totalDone / $totalSampel) * 100, 2) : 0;
                    
                    $history[] = [
                        'date' => $date,
                        'progress' => $overallPct
                    ];
                }
            }
        }
        
        // Calculate diff (kenaikan)
        $history = array_reverse($history); // oldest to newest
        for ($i = 0; $i < count($history); $i++) {
            if ($i === 0) {
                $history[$i]['kenaikan'] = 0;
            } else {
                $history[$i]['kenaikan'] = round($history[$i]['progress'] - $history[$i-1]['progress'], 2);
            }
        }
        
        header('Content-Type: application/json');
        echo json_encode($history);
        exit;
    }
}

if ($type === 'data') {
    if ($date) {
        $dataFile = __DIR__ . '/data_' . $date . '.json';
    } else {
        // Fallback to data.json if no date
        $dataFile = __DIR__ . '/data.json';
    }
} else if ($type === 'ignored') {
    $dataFile = __DIR__ . '/ignored.json';
} else if ($type === 'verified_kecamatan') {
    $dataFile = __DIR__ . '/verified_kecamatan.json';
} else if ($type === 'surat') {
    $dataFile = __DIR__ . '/surat.json';
} else if ($type === 'affirmasi') {
    $dataFile = __DIR__ . '/affirmasi.json';
} else {
    $dataFile = __DIR__ . ($type === 'officers' ? '/officers.json' : '/wilayah.json');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dataFile)) {
        header('Content-Type: application/json');
        echo file_get_contents($dataFile);
    } else {
        echo json_encode([]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if ($type === 'clear_all_data') {
        $files = glob(__DIR__ . '/data_*.json');
        foreach ($files as $f) {
            unlink($f);
        }
        if (file_exists(__DIR__ . '/data.json')) {
            unlink(__DIR__ . '/data.json');
        }
        if (file_exists(__DIR__ . '/ignored.json')) {
            unlink(__DIR__ . '/ignored.json');
        }
        if (file_exists(__DIR__ . '/verified_kecamatan.json')) {
            unlink(__DIR__ . '/verified_kecamatan.json');
        }
        echo json_encode(['status' => 'success', 'message' => 'All data cleared']);
        exit;
    } else if ($type === 'delete_by_date' && $date) {
        $fileToDelete = __DIR__ . '/data_' . $date . '.json';
        if (file_exists($fileToDelete)) {
            unlink($fileToDelete);
            echo json_encode(['status' => 'success', 'message' => 'Data for date cleared']);
        } else {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'File not found']);
        }
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    // Validasi JSON sederhana
    json_decode($input);
    if (json_last_error() === JSON_ERROR_NONE) {
        if ($type === 'data') {
            $uploadType = isset($_GET['uploadType']) ? $_GET['uploadType'] : '';
            $isPencacahUpload = ($uploadType === 'pencacah');
            
            $newData = json_decode($input, true);
            if (is_array($newData)) {
                $map = [];
                
                if (file_exists($dataFile)) {
                    $existingData = json_decode(file_get_contents($dataFile), true);
                    if (is_array($existingData)) {
                        foreach ($existingData as $item) {
                            // Skip items that match the upload type we are completely replacing
                            if ($uploadType !== '') {
                                $itemIsPencacah = isset($item['isPencacah']) && $item['isPencacah'] ? true : false;
                                if ($itemIsPencacah === $isPencacahUpload) {
                                    continue;
                                }
                            }
                            if (isset($item['id'])) $map[$item['id']] = $item;
                        }
                    }
                }
                
                foreach ($newData as $item) {
                    if (isset($item['id'])) $map[$item['id']] = $item;
                }
                $input = json_encode(array_values($map));
            }
        }
        file_put_contents($dataFile, $input);
        echo json_encode(['status' => 'success']);
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    }
    exit;
}
?>
