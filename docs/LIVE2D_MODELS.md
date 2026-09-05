# Catálogo de Modelos Live2D Cubism en Cristi AI

Referencia técnica de los 13 modelos Live2D integrados en Cristi AI.

---

## 1. Modelos Disponibles

| ID | Nombre | Universo / Temática | Parámetros | Expresiones | Movimientos | Voz Recomendada | Fuente / Origen |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `yanderegirl` | **Cristi Gótica (Yandere Girl)** | Original / Cyber-Goth | 75 | `Yandere`, `Mad`, `Crazy`, `Scared` | `idle` | `Aoede` | Interno |
| `icegirl` | **Ice Girl (Cheongsam)** | Fantasy / Anime | 94 | 12 expresiones (Sonrojo, Alas, Ojos corazón) | `DaiJi`, `HuiShou`, `MeiYan` | `Kore` | Booth |
| `hiyori` | **Hiyori (Pro Cubism)** | Live2D Official Sample | 64 | Expresiones estándar | 8 animaciones motion3 | `Zephyr` | Live2D Sample |
| `miara` | **Miara (Pro Cubism)** | Live2D Official Sample | 65 | Expresiones estándar | 3 animaciones motion3 | `Leda` | Live2D Sample |
| `toki` | **Toki (Asuka)** | Blue Archive | 74 | Gestos y mirada | `idle` | `Aoede` | Booth |
| `ellen` | **Ellen Joe** | Zenless Zone Zero | 207 | `black`, `red`, `shock`, `shou`, `tang` | `idle`, `idle2` | `Aoede` | HoYoverse / Booth |
| `jane_doe` | **Jane Doe** | Zenless Zone Zero | 236 | `脸红`, `爱心眼`, `白眼`, `生气`, `血`, etc. | `Scene1` | `Kore` | HoYoverse / Booth |
| `ruan_mei` | **Ruan Mei** | Honkai: Star Rail | 114 | Gestos refinados y físicas | `idle` | `Leda` | HoYoverse / Booth |
| `belle` | **Belle (ZZZ)** | Zenless Zone Zero | 175 | `blueEye`, `Glasses` | `idle` (motion3) | `Aoede` | [Booth 5399636](https://booth.pm/en/items/5399636) |
| `sparkle` | **Sparkle (Star Rail)** | Honkai: Star Rail | 174 | `hide_highlights`, `hand_pose`, `leg_pose` | `Idle`, `2`, `3`, `daqiu` | `Zephyr` | [Booth 5546825](https://booth.pm/en/items/5546825) |
| `huohuo` | **Huohuo (Star Rail)** | Honkai: Star Rail | 157 | `angry`, `cry`, `baozhen`, `qizi1`, `qizi2`, `white_eyes` | 7 animaciones motion3 | `Kore` | [Booth 5288339](https://booth.pm/en/items/5288339) |
| `vivian` | **Vivian (ZZZ)** | Zenless Zone Zero | 197 | `umbrella_closed`, `cry`, `shy`, `flustered`, `roll_eyes`, `dark_face` | `Scene1` (motion3) | `Leda` | [Booth 7811941](https://booth.pm/en/items/7811941) |
| `goth_loli` | **GothLoli Maid** | Gothic Lolita / Maid | 30 | Expresiones estándar, physics en coletas y lazos | Físicas y parpadeo | `Aoede` | [Booth 4690141](https://booth.pm/en/items/4690141) |

---

### Nota sobre archivos adicionales analizados:
- **`MellowHeart_Dream1.05.zip` ([Booth 6975498](https://booth.pm/en/items/6975498))**: Paquete de ropa 3D FBX / Unitypackage para avatares VRChat (no contiene archivos Live2D Cubism runtime).
- **`VEIL_MURASAKIYA.zip` ([Booth 5884021](https://booth.pm/en/items/5884021))**: Accesorio de velo de encaje 3D Maria Lace Veil (.unitypackage) para VRChat (no contiene archivos Live2D Cubism runtime).

---

## 2. Parámetros Estándar Universales

Cada modelo se mapea a los siguientes identificadores semánticos:
- `head_angle_x`, `head_angle_y`, `head_angle_z`: Inclinación de la cabeza.
- `body_angle_x`, `body_angle_y`, `body_angle_z`: Balanceo y postura corporal.
- `eye_l_open`, `eye_r_open`: Apertura y parpadeo de ojos.
- `eye_l_smile`, `eye_r_smile`: Ojos sonrientes.
- `eye_ball_x`, `eye_ball_y`: Seguimiento de la mirada.
- `brow_l_y`, `brow_r_y`, `brow_l_angle`, `brow_r_angle`: Expresión de cejas.
- `mouth_open_y`, `mouth_form`: Sincronización labial y modulación vocal.
- `breath`: Respiración continua.

---

## 3. Ocultamiento de Marcas de Agua (`hiddenParts`)
En modelos que contienen capas o textos superpuestos de distribución (como Ellen Joe), el perfil especifica:
```javascript
hiddenParts: ['Part17']
```
El motor `Live2DAdapter` fuerza automáticamente la opacidad de estas partes a `0` sin dañar el archivo binario del modelo.
