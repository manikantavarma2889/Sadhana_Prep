export function syntheticResume() {
  const stream = 'BT /F1 12 Tf 72 710 Td (Alex Example - React, TypeScript, Node.js, Express, and Git.) Tj ' +
    '0 -20 Td (Project: CampusConnect. Built a React and TypeScript student dashboard.) Tj ' +
    '0 -20 Td (Implemented keyboard navigation and Express APIs with MongoDB.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let doc = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = doc.length;
    doc += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
    return offset.toString().padStart(10, '0') + ' 00000 n \n';
  });
  const xref = doc.length;
  doc += 'xref\n0 6\n0000000000 65535 f \n' + offsets.join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(doc, 'ascii');
}
