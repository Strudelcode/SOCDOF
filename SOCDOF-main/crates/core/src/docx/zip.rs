//! The ZIP container of an OOXML package.
//!
//! Writing uses deflate, which every Word installation reads; reading accepts both deflate and
//! store, the two methods Word and the usual Python and Rust tools produce. ZIP64, encryption and
//! multi-disk archives are not supported and report [`DocxError::UnsupportedCompression`] or a
//! damaged-package error instead of guessing.

use std::io::{Read, Write};

use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use flate2::Compression;

use super::DocxError;

const LOCAL_SIGNATURE: u32 = 0x0403_4b50;
const CENTRAL_SIGNATURE: u32 = 0x0201_4b50;
const END_SIGNATURE: u32 = 0x0605_4b50;
const END_RECORD: usize = 22;
const FLAG_ENCRYPTED: u16 = 0x0001;

/// Builds a ZIP archive from named entries.
pub fn write(entries: &[(String, Vec<u8>)]) -> Vec<u8> {
    let mut body = Vec::new();
    let mut directory = Vec::new();
    for (name, data) in entries {
        let offset = body.len() as u32;
        let compressed = deflate(data);
        let crc = crc32(data);
        let name = name.as_bytes();
        let mut local = Vec::with_capacity(30 + name.len());
        push_u32(&mut local, LOCAL_SIGNATURE);
        push_u16(&mut local, 20);
        push_u16(&mut local, 0);
        push_u16(&mut local, 8);
        push_u16(&mut local, 0);
        push_u16(&mut local, 0);
        push_u32(&mut local, crc);
        push_u32(&mut local, compressed.len() as u32);
        push_u32(&mut local, data.len() as u32);
        push_u16(&mut local, name.len() as u16);
        push_u16(&mut local, 0);
        local.extend_from_slice(name);
        body.extend_from_slice(&local);
        body.extend_from_slice(&compressed);

        push_u32(&mut directory, CENTRAL_SIGNATURE);
        push_u16(&mut directory, 20);
        push_u16(&mut directory, 20);
        push_u16(&mut directory, 0);
        push_u16(&mut directory, 8);
        push_u16(&mut directory, 0);
        push_u16(&mut directory, 0);
        push_u32(&mut directory, crc);
        push_u32(&mut directory, compressed.len() as u32);
        push_u32(&mut directory, data.len() as u32);
        push_u16(&mut directory, name.len() as u16);
        push_u16(&mut directory, 0);
        push_u16(&mut directory, 0);
        push_u16(&mut directory, 0);
        push_u16(&mut directory, 0);
        push_u32(&mut directory, 0);
        push_u32(&mut directory, offset);
        directory.extend_from_slice(name);
    }
    let directory_offset = body.len() as u32;
    body.extend_from_slice(&directory);
    push_u32(&mut body, END_SIGNATURE);
    push_u16(&mut body, 0);
    push_u16(&mut body, 0);
    push_u16(&mut body, entries.len() as u16);
    push_u16(&mut body, entries.len() as u16);
    push_u32(&mut body, directory.len() as u32);
    push_u32(&mut body, directory_offset);
    push_u16(&mut body, 0);
    body
}

/// Reads one entry by name; `None` when the archive does not contain it.
pub fn read(bytes: &[u8], wanted: &str) -> Result<Option<Vec<u8>>, DocxError> {
    for (name, data) in entries(bytes)? {
        if name == wanted {
            return Ok(Some(data));
        }
    }
    Ok(None)
}

/// Reads every entry of the archive.
fn entries(bytes: &[u8]) -> Result<Vec<(String, Vec<u8>)>, DocxError> {
    let end = end_record(bytes)?;
    let count = u16_at(bytes, end + 10)? as usize;
    let directory_size = u32_at(bytes, end + 12)? as usize;
    let directory_offset = u32_at(bytes, end + 16)? as usize;
    if count == 0xFFFF || directory_offset == u32::MAX as usize || directory_size == 0xFFFF_FFFF {
        return Err(DocxError::Damaged(
            "the archive uses ZIP64, which is not supported".to_string(),
        ));
    }
    if directory_offset + directory_size > bytes.len() {
        return Err(DocxError::Damaged(
            "the central directory points past the file".to_string(),
        ));
    }

    let mut result = Vec::with_capacity(count);
    let mut position = directory_offset;
    for _ in 0..count {
        if u32_at(bytes, position)? != CENTRAL_SIGNATURE {
            return Err(DocxError::Damaged(
                "the central directory is broken".to_string(),
            ));
        }
        let flags = u16_at(bytes, position + 8)?;
        let method = u16_at(bytes, position + 10)?;
        let compressed_size = u32_at(bytes, position + 20)? as usize;
        let name_length = u16_at(bytes, position + 28)? as usize;
        let extra_length = u16_at(bytes, position + 30)? as usize;
        let comment_length = u16_at(bytes, position + 32)? as usize;
        let local_offset = u32_at(bytes, position + 42)? as usize;
        if flags & FLAG_ENCRYPTED != 0 {
            return Err(DocxError::Damaged(
                "the archive is encrypted, which is not supported".to_string(),
            ));
        }
        let name = text(bytes, position + 46, name_length)?;
        let data = entry_data(bytes, local_offset, compressed_size, method)?;
        result.push((name, data));
        position += 46 + name_length + extra_length + comment_length;
    }
    Ok(result)
}

/// Offset of the end-of-central-directory record.
fn end_record(bytes: &[u8]) -> Result<usize, DocxError> {
    if bytes.len() < END_RECORD {
        return Err(DocxError::NotAPackage);
    }
    let limit = bytes.len().saturating_sub(END_RECORD + 65_535);
    for position in (limit..=bytes.len() - END_RECORD).rev() {
        if u32_at(bytes, position)? == END_SIGNATURE {
            return Ok(position);
        }
    }
    Err(DocxError::NotAPackage)
}

/// Decompresses the data of one entry, following its local header.
fn entry_data(
    bytes: &[u8],
    local_offset: usize,
    compressed_size: usize,
    method: u16,
) -> Result<Vec<u8>, DocxError> {
    if u32_at(bytes, local_offset)? != LOCAL_SIGNATURE {
        return Err(DocxError::Damaged(
            "a local file header is broken".to_string(),
        ));
    }
    let name_length = u16_at(bytes, local_offset + 26)? as usize;
    let extra_length = u16_at(bytes, local_offset + 28)? as usize;
    let start = local_offset + 30 + name_length + extra_length;
    let end = start
        .checked_add(compressed_size)
        .filter(|end| *end <= bytes.len())
        .ok_or_else(|| DocxError::Damaged("an entry points past the file".to_string()))?;
    let raw = &bytes[start..end];
    match method {
        0 => Ok(raw.to_vec()),
        8 => {
            let mut decoder = DeflateDecoder::new(raw);
            let mut data = Vec::new();
            decoder
                .read_to_end(&mut data)
                .map_err(|error| DocxError::Damaged(format!("deflate failed: {error}")))?;
            Ok(data)
        }
        other => Err(DocxError::UnsupportedCompression(other)),
    }
}

/// Reads a UTF-8 string of `length` bytes at `offset`.
fn text(bytes: &[u8], offset: usize, length: usize) -> Result<String, DocxError> {
    let slice = bytes
        .get(offset..offset + length)
        .ok_or_else(|| DocxError::Damaged("an entry name points past the file".to_string()))?;
    Ok(String::from_utf8_lossy(slice).into_owned())
}

fn u16_at(bytes: &[u8], offset: usize) -> Result<u16, DocxError> {
    let slice = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| DocxError::Damaged("the archive ends unexpectedly".to_string()))?;
    Ok(u16::from_le_bytes([slice[0], slice[1]]))
}

fn u32_at(bytes: &[u8], offset: usize) -> Result<u32, DocxError> {
    let slice = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| DocxError::Damaged("the archive ends unexpectedly".to_string()))?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn push_u16(target: &mut Vec<u8>, value: u16) {
    target.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(target: &mut Vec<u8>, value: u32) {
    target.extend_from_slice(&value.to_le_bytes());
}

/// Raw deflate stream of `data`.
fn deflate(data: &[u8]) -> Vec<u8> {
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data).expect("in-memory deflate");
    encoder.finish().expect("in-memory deflate")
}

/// CRC-32/ISO-HDLC of `data`, as the ZIP format stores it.
fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for byte in data {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc32_matches_the_published_check_value() {
        // The check value of the CRC-32/ISO-HDLC algorithm over "123456789".
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn entries_survive_a_write_and_read_round_trip() {
        let entries = vec![
            ("word/document.xml".to_string(), b"<xml/>".to_vec()),
            ("[Content_Types].xml".to_string(), vec![b'x'; 5000]),
        ];
        let archive = write(&entries);
        assert_eq!(inner_len(&archive, 0), entries[0].1.len());
        assert_eq!(
            read(&archive, "word/document.xml").unwrap().unwrap(),
            entries[0].1
        );
        assert_eq!(
            read(&archive, "[Content_Types].xml").unwrap().unwrap(),
            entries[1].1
        );
        assert_eq!(read(&archive, "missing").unwrap(), None);
    }

    fn inner_len(archive: &[u8], index: usize) -> usize {
        entries(archive).unwrap()[index].1.len()
    }

    #[test]
    fn plain_bytes_are_not_a_package() {
        assert_eq!(entries(b"not a zip"), Err(DocxError::NotAPackage));
        assert_eq!(entries(&[]), Err(DocxError::NotAPackage));
    }

    #[test]
    fn a_truncated_archive_is_reported() {
        let archive = write(&[("a".to_string(), b"hello".to_vec())]);
        let truncated = &archive[..archive.len() - 5];
        assert!(matches!(entries(truncated), Err(DocxError::NotAPackage)));
    }
}
