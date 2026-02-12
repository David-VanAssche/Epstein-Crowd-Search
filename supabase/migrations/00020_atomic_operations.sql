-- Atomic RPC functions to prevent race conditions on concurrent writes

-- Atomically append a message to a chat conversation's JSONB messages array
CREATE OR REPLACE FUNCTION append_chat_message(
  p_conversation_id UUID,
  p_message JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_conversations
  SET
    messages = COALESCE(messages, '[]'::jsonb) || p_message,
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$;

-- Atomically increment an annotation vote count
CREATE OR REPLACE FUNCTION increment_annotation_vote(
  p_annotation_id UUID,
  p_vote_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_vote_type = 'upvote' THEN
    UPDATE annotations
    SET upvotes = COALESCE(upvotes, 0) + 1
    WHERE id = p_annotation_id
    RETURNING jsonb_build_object('id', id, 'upvotes', upvotes, 'downvotes', downvotes) INTO result;
  ELSIF p_vote_type = 'downvote' THEN
    UPDATE annotations
    SET downvotes = COALESCE(downvotes, 0) + 1
    WHERE id = p_annotation_id
    RETURNING jsonb_build_object('id', id, 'upvotes', upvotes, 'downvotes', downvotes) INTO result;
  ELSE
    RAISE EXCEPTION 'Invalid vote type: %', p_vote_type;
  END IF;

  RETURN result;
END;
$$;

-- Atomically recalculate proposal vote totals from the votes table
CREATE OR REPLACE FUNCTION recalculate_proposal_votes(
  p_proposal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_upvotes INT;
  v_downvotes INT;
  v_corroborations INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE vote_type = 'upvote'),
    COUNT(*) FILTER (WHERE vote_type = 'downvote'),
    COUNT(*) FILTER (WHERE vote_type = 'corroborate')
  INTO v_upvotes, v_downvotes, v_corroborations
  FROM proposal_votes
  WHERE proposal_id = p_proposal_id;

  UPDATE redaction_proposals
  SET
    upvotes = v_upvotes,
    downvotes = v_downvotes,
    corroborations = v_corroborations
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'upvotes', v_upvotes,
    'downvotes', v_downvotes,
    'corroborations', v_corroborations
  );
END;
$$;
