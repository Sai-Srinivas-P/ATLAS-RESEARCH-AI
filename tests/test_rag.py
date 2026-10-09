from atlas_research.rag import chunk_text


def test_chunk_text_overlap():
    chunks = chunk_text("abcdefghijklmnopqrstuvwxyz", chunk_size=10, overlap=3)
    assert len(chunks) >= 3
    assert chunks[0]
    assert chunks[-1]
