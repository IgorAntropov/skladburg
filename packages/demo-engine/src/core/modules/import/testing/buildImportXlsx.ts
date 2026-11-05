import {
  strToU8,
  zipSync,
} from 'fflate';

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const SPREADSHEET_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const PACKAGE_RELATIONSHIP_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOCUMENT_RELATIONSHIP_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const escapeXml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll('\'', '&apos;');

const encodeXml = (content: string): Uint8Array => strToU8(`${DECLARATION}${content}`);

const serializeRow = (values: readonly string[], rowIndex: number): string => {
  const cells = values.map((value, columnIndex) => {
    const column = columnIndex < 26 ? String.fromCharCode(65 + columnIndex) : `A${String.fromCharCode(65 + columnIndex - 26)}`;
    return `<c r="${column}${String(rowIndex + 1)}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  });
  return `<row r="${String(rowIndex + 1)}">${cells.join('')}</row>`;
};

export const buildImportXlsx = (headers: readonly string[], rows: readonly (readonly string[])[]): Uint8Array => zipSync({
  '[Content_Types].xml': encodeXml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml"'
    + ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '</Types>'),
  '_rels/.rels': encodeXml(`<Relationships xmlns="${PACKAGE_RELATIONSHIP_NAMESPACE}">`
    + `<Relationship Id="rId1" Type="${DOCUMENT_RELATIONSHIP_NAMESPACE}/officeDocument" Target="xl/workbook.xml"/>`
    + '</Relationships>'),
  'xl/_rels/workbook.xml.rels': encodeXml(`<Relationships xmlns="${PACKAGE_RELATIONSHIP_NAMESPACE}">`
    + `<Relationship Id="rId1" Type="${DOCUMENT_RELATIONSHIP_NAMESPACE}/worksheet" Target="worksheets/sheet1.xml"/>`
    + '</Relationships>'),
  'xl/workbook.xml': encodeXml(`<workbook xmlns="${SPREADSHEET_NAMESPACE}" xmlns:r="${DOCUMENT_RELATIONSHIP_NAMESPACE}">`
    + '<sheets><sheet name="Каталог" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/worksheets/sheet1.xml': encodeXml(`<worksheet xmlns="${SPREADSHEET_NAMESPACE}"><sheetData>`
    + [headers, ...rows].map(serializeRow).join('') + '</sheetData></worksheet>'),
});
