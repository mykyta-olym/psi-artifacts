// src/pages/print-reports/utils/reportUtils.jsx
import { maisId } from '../../../utils/ids';

export const pad = (n) => String(n).padStart(2, '0');

export const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const hash = (s) => {
    let h = 2166136261 >>> 0;
    const x = String(s || '');
    for (let i = 0; i < x.length; i++) {
        h ^= x.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

export const school = {
    nameSk: 'Technická univerzita v Košiciach',
    nameEn: 'Technical University of Košice',
    facultySk: 'Fakulta elektrotechniky a informatiky',
    facultyEn: 'Faculty of Electrical Engineering and Informatics',
    addressSk: 'Letná 9, 042 00 Košice',
    addressEn: 'Letná 9, 042 00 Košice, Slovakia'
};

export const degreeToLevel = (deg = '') => {
    const d = String(deg || '').toLowerCase();
    if (/ing|mgr|master/.test(d)) return 'M.Sc.';
    if (/bc|bachelor|bakal/.test(d)) return 'B.Sc.';
    return 'B.Sc.';
};

export const defaultForm = (profile, user, study) => {
    const fn = profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Student';
    const prog = study?.programName || study?.programCode || profile?.program || '';
    const fac = study?.faculty || profile?.faculty || '';
    const id = user?.id || maisId('stu', user?.email || fn);
    const level = degreeToLevel(study?.degree);
    const year = String(study?.ospYear || '1');
    return {
        fullName: fn,
        dateOfBirth: '',
        placeOfBirth: '',
        nationalId: '',
        address: '',
        program: prog,
        faculty: fac,
        studyForm: 'Full-time',
        studyLevel: level,
        year,
        phone: '',
        email: user?.email || '',
        studentId: id,
        issuedAt: today(),
        validUntil: '',
        accommodationAddress: '',
        accommodationFrom: today(),
        accommodationTo: '',
        upsvarPurpose: 'For state social support purposes',
        language: 'en',
        includeQr: true,
        includeWatermark: true
    };
};

export const buildMark = (seed) => {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const bits = [];
    let s = hash(seed);
    for (let i = 0; i < 16 * 16; i++) {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        bits.push(s & 1);
    }
    const cell = Math.floor(size / 16);
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            if (bits[y * 16 + x]) {
                ctx.fillStyle = '#111827';
                ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
            }
        }
    }
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    return c.toDataURL('image/png');
};

export const water = () => `
  <div style="position:fixed;inset:0;pointer-events:none;opacity:.06;display:flex;align-items:center;justify-content:center;transform:rotate(-22deg);font-size:92px;font-weight:800;color:#111;">
    COPY
  </div>
`;

export const styleSheet = `
  <style>
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,"Helvetica Neue",Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji";line-height:1.35;margin:0;background:#fff;color:#111827}
    .doc{width:100%;max-width:100%;margin:0 auto;padding:24px}
    .hdr{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
    .hdr .logo{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
    .hdr h1{font-size:22px;margin:0 0 4px 0}
    .hdr p{margin:0;color:#6b7280}
    .title{margin:24px 0 12px 0;text-transform:uppercase;font-size:18px;font-weight:800}
    .sub{color:#374151;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}
    .row{display:grid;grid-template-columns:220px 1fr;gap:12px;padding:8px 0;border-bottom:1px dashed #e5e7eb}
    .row:last-child{border-bottom:0}
    .lbl{color:#6b7280}
    .val{font-weight:600}
    .foot{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb}
    .sign{height:48px;display:flex;align-items:flex-end}
    .muted{color:#6b7280}
    .badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;flex-shrink:0}
    .tiny{font-size:12px;color:#6b7280}
    @media (max-width:740px){.grid{grid-template-columns:1fr}.row{grid-template-columns:1fr}.hdr h1{font-size:18px}}
    @media print { body{padding:0} .doc{padding:24px} }
  </style>
`;

export const renderDoc = (kind, f) => {
  const qr = f.includeQr ? buildMark(`${kind}|${f.fullName}|${f.studentId}|${f.year}`) : null;
    const head = `
    <div class="hdr">
      <div class="logo">TUKE</div>
      <div>
        <h1>${school.nameEn}</h1>
        <p>${school.facultyEn} • ${school.addressEn}</p>
      </div>
      <div style="margin-left:auto" class="badge">
        <div>
          <div class="tiny">ID</div>
          <div><strong>${f.studentId}</strong></div>
        </div>
        ${qr ? `<img src="${qr}" width="48" height="48" alt="QR"/>` : ''}
      </div>
    </div>
  `;
    if (kind === 'confirm') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Confirmation of Study</div>
        <div class="sub">Confirmation for student needs.</div>
        <div class="grid">
          <div class="row"><div class="lbl">Full name</div><div class="val">${f.fullName}</div></div>
          <div class="row"><div class="lbl">Study program</div><div class="val">${f.program}</div></div>
          <div class="row"><div class="lbl">Faculty</div><div class="val">${f.faculty}</div></div>
          <div class="row"><div class="lbl">Form of study</div><div class="val">${f.studyForm}</div></div>
          <div class="row"><div class="lbl">Study level</div><div class="val">${f.studyLevel}</div></div>
          <div class="row"><div class="lbl">Year</div><div class="val">${f.year}</div></div>
          <div class="row"><div class="lbl">Issued at</div><div class="val">${f.issuedAt}</div></div>
          ${f.validUntil ? `<div class="row"><div class="lbl">Valid until</div><div class="val">${f.validUntil}</div></div>` : ''}
        </div>
        <div class="foot">
          <div>
            <div class="muted">Issued by</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    if (kind === 'confirm_upsvar') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Confirmation of Study for Labour Office</div>
        <div class="sub">${f.upsvarPurpose || 'For the purposes of the Labour, Social Affairs and Family Office'}</div>
        <div class="grid">
          <div class="row"><div class="lbl">Full name</div><div class="val">${f.fullName}</div></div>
          <div class="row"><div class="lbl">National ID</div><div class="val">${f.nationalId || '—'}</div></div>
          <div class="row"><div class="lbl">Address</div><div class="val">${f.address || '—'}</div></div>
          <div class="row"><div class="lbl">Study program</div><div class="val">${f.program}</div></div>
          <div class="row"><div class="lbl">Issued at</div><div class="val">${f.issuedAt}</div></div>
        </div>
        <div class="foot">
          <div>
            <div class="muted">Issued by</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    if (kind === 'immatriculation') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Matriculation Letter</div>
        <div class="sub">Confirmation of matriculation.</div>
        <div class="grid">
          <div class="row"><div class="lbl">Full name</div><div class="val">${f.fullName}</div></div>
          <div class="row"><div class="lbl">Date of birth</div><div class="val">${f.dateOfBirth || '—'}</div></div>
          <div class="row"><div class="lbl">Place of birth</div><div class="val">${f.placeOfBirth || '—'}</div></div>
          <div class="row"><div class="lbl">Program</div><div class="val">${f.program}</div></div>
          <div class="row"><div class="lbl">Year</div><div class="val">${f.year}</div></div>
          <div class="row"><div class="lbl">Enrollment date</div><div class="val">${f.issuedAt}</div></div>
        </div>
        <div class="foot">
          <div>
            <div class="muted">Study office</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    if (kind === 'study_overview') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Study Overview</div>
        <div class="sub">Basic study progress details.</div>
        <div class="grid">
          <div class="row"><div class="lbl">Full name</div><div class="val">${f.fullName}</div></div>
          <div class="row"><div class="lbl">Program</div><div class="val">${f.program}</div></div>
          <div class="row"><div class="lbl">Level</div><div class="val">${f.studyLevel}</div></div>
          <div class="row"><div class="lbl">Form</div><div class="val">${f.studyForm}</div></div>
          <div class="row"><div class="lbl">Year</div><div class="val">${f.year}</div></div>
        </div>
        <div style="margin-top:18px" class="tiny">Note: Detailed subject and grade listings are available in MAIS.</div>
        <div class="foot">
          <div>
            <div class="muted">Issued by</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    if (kind === 'accommodation_contract') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Accommodation Contract</div>
        <div class="sub">Student accommodation in a dormitory.</div>
        <div class="grid">
          <div class="row"><div class="lbl">Student</div><div class="val">${f.fullName} • ${f.studentId}</div></div>
          <div class="row"><div class="lbl">Accommodation period</div><div class="val">${f.accommodationFrom} – ${f.accommodationTo || '—'}</div></div>
          <div class="row"><div class="lbl">Accommodation address</div><div class="val">${f.accommodationAddress || '—'}</div></div>
          <div class="row"><div class="lbl">Contacts</div><div class="val">${f.email || '—'} ${f.phone ? '• ' + f.phone : ''}</div></div>
        </div>
        <div class="foot">
          <div>
            <div class="muted">Dormitory</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    if (kind === 'accommodation_addendum') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Accommodation Contract Addendum</div>
        <div class="sub">Change of accommodation parameters.</div>
        <div class="grid">
          <div class="row"><div class="lbl">Student</div><div class="val">${f.fullName} • ${f.studentId}</div></div>
          <div class="row"><div class="lbl">Previous period</div><div class="val">${f.accommodationFrom} – ${f.accommodationTo || '—'}</div></div>
          <div class="row"><div class="lbl">New period</div><div class="val">${f.accommodationFrom} – ${f.validUntil || '—'}</div></div>
        </div>
        <div class="foot">
          <div>
            <div class="muted">Approved by</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    if (kind === 'residence_report') {
        return `
      ${styleSheet}
      <div class="doc">
        ${f.includeWatermark ? water() : ''}
        ${head}
        <div class="title">Residence Report</div>
        <div class="sub">Notification of residence during studies.</div>
        <div class="grid">
          <div class="row"><div class="lbl">Full name</div><div class="val">${f.fullName}</div></div>
          <div class="row"><div class="lbl">Permanent address</div><div class="val">${f.address || '—'}</div></div>
          <div class="row"><div class="lbl">Temporary residence</div><div class="val">${f.accommodationAddress || '—'}</div></div>
          <div class="row"><div class="lbl">Valid from</div><div class="val">${f.accommodationFrom}</div></div>
        </div>
        <div class="foot">
          <div>
            <div class="muted">Student signature</div>
            <div class="sign">________________________</div>
          </div>
          <div class="tiny">Verification: ${hash(JSON.stringify(f)).toString(16)}</div>
        </div>
      </div>
    `;
    }
    return '';
};